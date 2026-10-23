#include "ns3/core-module.h"
#include "ns3/flow-monitor-module.h"
#include "ns3/internet-module.h"
#include "ns3/ipv4-static-routing-helper.h"
#include "ns3/mobility-module.h"
#include "ns3/network-module.h"
#include "ns3/wifi-module.h"
#include "ns3/applications-module.h"

#include <cmath>
#include <iomanip>
#include <iostream>
#include <map>
#include <string>

using namespace ns3;

namespace {

std::map<FlowId, FlowMonitor::FlowStats> previousStats;
Time previousSnapshot;
Ptr<Ipv4FlowClassifier> flowClassifier;
Ptr<Ipv4StaticRouting> sourceRoutes;
Ipv4Address telemetryDestination;
Ipv4Address alternateNextHop;
uint32_t sourceInterface;
uint32_t primaryRouteIndex;
uint64_t previousSentPackets;
uint64_t previousReceivedPackets;
constexpr uint32_t telemetryPacketSize = 256;

void reportWindow(Ptr<FlowMonitor> monitor,
                  Ptr<UdpClient> client,
                  Ptr<UdpServer> server,
                  double endSeconds,
                  const std::string &label) {
  monitor->CheckForLostPackets();
  const auto stats = monitor->GetFlowStats();
  const Time window = Seconds(endSeconds) - previousSnapshot;
  const uint64_t sentPackets = client->GetTotalTx() / telemetryPacketSize;
  const uint64_t receivedPackets = server->GetReceived();
  const uint64_t tx = sentPackets - previousSentPackets;
  const uint64_t rx = receivedPackets - previousReceivedPackets;
  double meanDelayMs = -1.0;

  for (const auto &entry : stats) {
    const auto tuple = flowClassifier->FindFlow(entry.first);
    if (tuple.destinationPort != 9000) {
      continue;
    }
    const auto prior = previousStats.find(entry.first);
    const Time oldDelay = prior == previousStats.end() ? Seconds(0) : prior->second.delaySum;
    const Time delay = entry.second.delaySum - oldDelay;
    if (rx > 0) {
      meanDelayMs = 1000.0 * delay.GetSeconds() / rx;
    }
    previousStats[entry.first] = entry.second;
  }

  const double pdr = tx == 0 ? 0.0 : 100.0 * static_cast<double>(rx) / tx;
  const double throughputKbps =
      window.GetSeconds() == 0 ? 0.0 : 8.0 * rx * telemetryPacketSize / window.GetSeconds() / 1000.0;
  std::cout << std::fixed << std::setprecision(2)
            << "{\"window\":\"" << label << "\",\"duration_s\":" << window.GetSeconds()
            << ",\"tx_packets\":" << tx << ",\"rx_packets\":" << rx
            << ",\"lost_packets_estimate\":" << (tx > rx ? tx - rx : 0)
            << ",\"pdr_pct\":" << pdr << ",\"mean_delay_ms\":";
  if (meanDelayMs < 0.0) {
    std::cout << "null";
  } else {
    std::cout << meanDelayMs;
  }
  std::cout << ",\"throughput_kbps\":" << throughputKbps << "}\n";
  previousSentPackets = sentPackets;
  previousReceivedPackets = receivedPackets;
  previousSnapshot = Seconds(endSeconds);
}

void disablePrimaryRelay(NetDeviceContainer devices) {
  auto device = DynamicCast<WifiNetDevice>(devices.Get(1));
  device->GetPhy()->SetOffMode();
  std::cout << "{\"event\":\"primary_relay_disabled\",\"time_s\":"
            << Simulator::Now().GetSeconds() << "}\n";
}

void switchToAlternativeRoute() {
  sourceRoutes->RemoveRoute(primaryRouteIndex);
  sourceRoutes->AddHostRouteTo(telemetryDestination, alternateNextHop, sourceInterface);
  std::cout << "{\"event\":\"alternative_route_selected\",\"time_s\":"
            << Simulator::Now().GetSeconds() << "}\n";
}

}  // namespace

int main(int argc, char *argv[]) {
  uint32_t packetIntervalMs = 200;
  CommandLine command(__FILE__);
  command.AddValue("packetIntervalMs", "Telemetry interval in milliseconds", packetIntervalMs);
  command.Parse(argc, argv);
  if (packetIntervalMs == 0) {
    std::cerr << "packetIntervalMs must be greater than zero\n";
    return 1;
  }

  NodeContainer nodes;
  nodes.Create(5);

  MobilityHelper mobility;
  Ptr<ListPositionAllocator> positions = CreateObject<ListPositionAllocator>();
  positions->Add(Vector(0.0, 0.0, 0.0));
  positions->Add(Vector(20.0, 0.0, 0.0));
  positions->Add(Vector(15.0, 15.0, 0.0));
  positions->Add(Vector(35.0, 0.0, 0.0));
  positions->Add(Vector(50.0, 0.0, 0.0));
  mobility.SetPositionAllocator(positions);
  mobility.SetMobilityModel("ns3::ConstantPositionMobilityModel");
  mobility.Install(nodes);

  YansWifiChannelHelper channel = YansWifiChannelHelper::Default();
  channel.AddPropagationLoss("ns3::RangePropagationLossModel",
                             "MaxRange", DoubleValue(30.0));
  YansWifiPhyHelper phy;
  phy.SetChannel(channel.Create());

  WifiHelper wifi;
  wifi.SetStandard(WIFI_STANDARD_80211g);
  wifi.SetRemoteStationManager("ns3::ConstantRateWifiManager",
                               "DataMode", StringValue("ErpOfdmRate6Mbps"),
                               "ControlMode", StringValue("ErpOfdmRate6Mbps"));
  WifiMacHelper mac;
  mac.SetType("ns3::AdhocWifiMac");
  NetDeviceContainer devices = wifi.Install(phy, mac, nodes);

  Ipv4StaticRoutingHelper staticRouting;
  InternetStackHelper internet;
  internet.SetRoutingHelper(staticRouting);
  internet.Install(nodes);

  Ipv4AddressHelper addresses;
  addresses.SetBase("10.8.0.0", "255.255.255.0");
  const Ipv4InterfaceContainer interfaces = addresses.Assign(devices);
  telemetryDestination = interfaces.GetAddress(4);
  alternateNextHop = interfaces.GetAddress(2);

  for (uint32_t node = 1; node <= 3; ++node) {
    Ptr<Ipv4> ipv4 = nodes.Get(node)->GetObject<Ipv4>();
    ipv4->SetForwarding(ipv4->GetInterfaceForDevice(devices.Get(node)), true);
  }
  Ipv4StaticRoutingHelper staticRoutingHelper;
  for (uint32_t node : {1U, 2U}) {
    Ptr<Ipv4> ipv4 = nodes.Get(node)->GetObject<Ipv4>();
    Ptr<Ipv4StaticRouting> routes = staticRoutingHelper.GetStaticRouting(ipv4);
    routes->AddHostRouteTo(telemetryDestination, interfaces.GetAddress(3),
                           ipv4->GetInterfaceForDevice(devices.Get(node)));
  }
  Ptr<Ipv4> relayThreeIpv4 = nodes.Get(3)->GetObject<Ipv4>();
  staticRoutingHelper.GetStaticRouting(relayThreeIpv4)->AddHostRouteTo(
      telemetryDestination, relayThreeIpv4->GetInterfaceForDevice(devices.Get(3)));
  Ptr<Ipv4> sourceIpv4 = nodes.Get(0)->GetObject<Ipv4>();
  sourceRoutes = staticRoutingHelper.GetStaticRouting(sourceIpv4);
  sourceInterface = sourceIpv4->GetInterfaceForDevice(devices.Get(0));
  primaryRouteIndex = sourceRoutes->GetNRoutes();
  sourceRoutes->AddHostRouteTo(telemetryDestination, interfaces.GetAddress(1), sourceInterface);

  constexpr uint16_t port = 9000;
  UdpServerHelper server(port);
  ApplicationContainer serverApp = server.Install(nodes.Get(4));
  serverApp.Start(Seconds(1.0));
  serverApp.Stop(Seconds(20.0));

  UdpClientHelper client(interfaces.GetAddress(4), port);
  client.SetAttribute("MaxPackets", UintegerValue(1000));
  client.SetAttribute("Interval", TimeValue(MilliSeconds(packetIntervalMs)));
  client.SetAttribute("PacketSize", UintegerValue(256));
  ApplicationContainer clientApp = client.Install(nodes.Get(0));
  clientApp.Start(Seconds(2.0));
  clientApp.Stop(Seconds(20.0));
  Ptr<UdpClient> telemetryClient = DynamicCast<UdpClient>(clientApp.Get(0));
  Ptr<UdpServer> telemetryServer = DynamicCast<UdpServer>(serverApp.Get(0));

  FlowMonitorHelper flowHelper;
  Ptr<FlowMonitor> monitor = flowHelper.InstallAll();
  flowClassifier = DynamicCast<Ipv4FlowClassifier>(flowHelper.GetClassifier());
  if (!flowClassifier) {
    std::cerr << "Could not create IPv4 flow classifier\n";
    return 1;
  }

  Simulator::Schedule(Seconds(5.0), &reportWindow, monitor, telemetryClient, telemetryServer,
                      5.0, "ruta_primaria");
  Simulator::Schedule(Seconds(5.1), &disablePrimaryRelay, devices);
  Simulator::Schedule(Seconds(7.1), &switchToAlternativeRoute);
  Simulator::Schedule(Seconds(10.0), &reportWindow, monitor, telemetryClient, telemetryServer,
                      10.0, "falla_y_cambio_de_ruta");
  Simulator::Schedule(Seconds(20.0), &reportWindow, monitor, telemetryClient, telemetryServer,
                      20.0, "ruta_alternativa");
  Simulator::Stop(Seconds(20.1));
  Simulator::Run();
  const uint64_t sent = telemetryClient->GetTotalTx() / telemetryPacketSize;
  const uint64_t received = telemetryServer->GetReceived();
  const double pdr = sent == 0 ? 0.0 : 100.0 * received / sent;
  std::cout << std::fixed << std::setprecision(2)
            << "{\"summary\":\"application_delivery\",\"tx_packets\":" << sent
            << ",\"rx_packets\":" << received
            << ",\"pdr_pct\":" << pdr << "}\n";
  Simulator::Destroy();
  return 0;
}
