#include "ns3/applications-module.h"
#include "ns3/core-module.h"
#include "ns3/flow-monitor-module.h"
#include "ns3/internet-module.h"
#include "ns3/mobility-module.h"
#include "ns3/network-module.h"
#include "ns3/point-to-point-module.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <deque>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <system_error>
#include <utility>
#include <vector>

using namespace ns3;

namespace
{
struct PacketEvent
{
    std::uint64_t id;
    std::string origin;
    std::string destination;
    double simulationTimeSeconds;
};

std::deque<PacketEvent> g_packetEvents;
std::uint64_t g_nextPacketEventId = 1;
std::uint64_t g_sequence = 0;
std::string g_runId;
std::string g_outputPath;
double g_durationSeconds = 30.0;
bool g_simulationComplete = false;
Ptr<FlowMonitor> g_flowMonitor;
Ptr<Ipv4FlowClassifier> g_flowClassifier;

void
RecordPacketEvent(const std::string& origin, const std::string& destination)
{
    g_packetEvents.push_back(
        {g_nextPacketEventId++, origin, destination, Simulator::Now().GetSeconds()});
    if (g_packetEvents.size() > 200)
    {
        g_packetEvents.pop_front();
    }
}

class SiriawMeshTrafficApp : public Application
{
  public:
    SiriawMeshTrafficApp() = default;

    static TypeId GetTypeId()
    {
        static TypeId typeId =
            TypeId("ns3::SiriawMeshTrafficApp")
                .SetParent<Application>()
                .SetGroupName("Applications")
                .AddConstructor<SiriawMeshTrafficApp>();
        return typeId;
    }

    void Setup(Ipv4Address gatewayAddress,
               uint16_t port,
               std::string origin,
               Time interval)
    {
        m_gatewayAddress = gatewayAddress;
        m_port = port;
        m_origin = std::move(origin);
        m_interval = interval;
    }

  private:
    void StartApplication() override
    {
        m_running = true;
        m_socket = Socket::CreateSocket(GetNode(), UdpSocketFactory::GetTypeId());
        if (m_socket->Connect(InetSocketAddress(m_gatewayAddress, m_port)) != 0)
        {
            NS_FATAL_ERROR("No se pudo conectar el socket UDP de " << m_origin);
        }
        SendPacket();
    }

    void StopApplication() override
    {
        m_running = false;
        if (m_sendEvent.IsPending())
        {
            Simulator::Cancel(m_sendEvent);
        }
        if (m_socket)
        {
            m_socket->Close();
        }
    }

    void SendPacket()
    {
        if (!m_running)
        {
            return;
        }

        Ptr<Packet> packet = Create<Packet>(64);
        if (m_socket->Send(packet) < 0)
        {
            std::cerr << "No se pudo enviar el datagrama UDP de " << m_origin << std::endl;
        }
        else if (m_origin == "esp32")
        {
            RecordPacketEvent("esp32", "laptopgateway");
        }
        else
        {
            RecordPacketEvent(m_origin, "esp32");
            Simulator::Schedule(MilliSeconds(2),
                                &RecordPacketEvent,
                                std::string("esp32"),
                                std::string("laptopgateway"));
        }

        m_sendEvent = Simulator::Schedule(m_interval, &SiriawMeshTrafficApp::SendPacket, this);
    }

    Ptr<Socket> m_socket;
    EventId m_sendEvent;
    Ipv4Address m_gatewayAddress;
    uint16_t m_port{0};
    std::string m_origin;
    Time m_interval;
    bool m_running{false};
};
NS_OBJECT_ENSURE_REGISTERED(SiriawMeshTrafficApp);

void
SetLinkErrorModel(NetDeviceContainer devices, double packetErrorRate)
{
    for (uint32_t index = 0; index < devices.GetN(); ++index)
    {
        Ptr<RateErrorModel> errorModel = CreateObject<RateErrorModel>();
        errorModel->SetAttribute("ErrorUnit", EnumValue(RateErrorModel::ERROR_UNIT_PACKET));
        errorModel->SetAttribute("ErrorRate", DoubleValue(packetErrorRate));
        devices.Get(index)->SetAttribute("ReceiveErrorModel", PointerValue(errorModel));
    }
}

void
WriteMetricsSnapshot()
{
    double transmittedPackets = 0.0;
    double receivedPackets = 0.0;
    double delaySeconds = 0.0;
    double jitterSeconds = 0.0;
    double jitterSamples = 0.0;

    const auto flowStats = g_flowMonitor->GetFlowStats();
    for (const auto& [flowId, stats] : flowStats)
    {
        const auto tuple = g_flowClassifier->FindFlow(flowId);
        if (tuple.protocol != 17 || tuple.destinationPort != 9000)
        {
            continue;
        }
        transmittedPackets += stats.txPackets;
        receivedPackets += stats.rxPackets;
        delaySeconds += stats.delaySum.GetSeconds();
        jitterSeconds += stats.jitterSum.GetSeconds();
        if (stats.rxPackets > 1)
        {
            jitterSamples += stats.rxPackets - 1;
        }
    }

    const double rttMs = receivedPackets > 0.0
                             ? 2.0 * delaySeconds * 1000.0 / receivedPackets
                             : 0.0;
    const double jitterMs = jitterSamples > 0.0
                                ? 2.0 * jitterSeconds * 1000.0 / jitterSamples
                                : 0.0;
    const double packetLossPercent = transmittedPackets > 0.0
                                         ? std::max(0.0,
                                                    transmittedPackets - receivedPackets) *
                                               100.0 / transmittedPackets
                                         : 0.0;

    const std::filesystem::path outputPath(g_outputPath);
    const std::filesystem::path temporaryPath = outputPath.string() + ".tmp";
    std::filesystem::create_directories(outputPath.parent_path());
    {
        std::ofstream output(temporaryPath, std::ios::trunc);
        if (!output)
        {
            throw std::runtime_error("No se pudo escribir " + temporaryPath.string());
        }
        output << std::fixed << std::setprecision(3)
               << "{\"version\":1"
               << ",\"runId\":\"" << g_runId << "\""
               << ",\"sequence\":" << ++g_sequence
               << ",\"simulationStatus\":\""
               << (g_simulationComplete ? "completada" : "activa") << "\""
               << ",\"simulationTimeSeconds\":" << Simulator::Now().GetSeconds()
               << ",\"rttMs\":" << rttMs
               << ",\"jitterMs\":" << jitterMs
               << ",\"packetLossPercent\":" << packetLossPercent
               << ",\"packetEvents\":[";

        bool first = true;
        for (const auto& event : g_packetEvents)
        {
            if (!first)
            {
                output << ',';
            }
            first = false;
            output << "{\"id\":" << event.id
                   << ",\"origin\":\"" << event.origin
                   << "\",\"destination\":\"" << event.destination
                   << "\",\"simulationTimeSeconds\":" << event.simulationTimeSeconds << '}';
        }
        output << "]}\n";
        output.flush();
        if (!output)
        {
            throw std::runtime_error("No se pudieron completar las métricas NS-3.");
        }
    }

    std::error_code renameError;
    std::filesystem::rename(temporaryPath, outputPath, renameError);
    if (renameError)
    {
        throw std::system_error(renameError, "No se pudo publicar el archivo de métricas NS-3");
    }
}

void
PublishMetrics()
{
    WriteMetricsSnapshot();
    if (Simulator::Now().GetSeconds() + 1.0 <= g_durationSeconds)
    {
        Simulator::Schedule(Seconds(1.0), &PublishMetrics);
    }
}
} // namespace

int
main(int argc, char* argv[])
{
    double lossPercent = 0.0;
    std::string outputPath = "src/main/resources/static/ns3-metrics.json";
    CommandLine commandLine(__FILE__);
    commandLine.AddValue("duration", "Duración de la simulación en segundos", g_durationSeconds);
    commandLine.AddValue("lossPercent",
                         "Probabilidad de pérdida por enlace, de 0 a 100 por ciento",
                         lossPercent);
    commandLine.AddValue("output", "Ruta del archivo JSON de métricas", outputPath);
    commandLine.Parse(argc, argv);

    if (!std::isfinite(g_durationSeconds) || g_durationSeconds < 2.0)
    {
        NS_FATAL_ERROR("La duración debe ser de al menos 2 segundos.");
    }
    if (!std::isfinite(lossPercent) || lossPercent < 0.0 || lossPercent > 100.0)
    {
        NS_FATAL_ERROR("lossPercent debe estar entre 0 y 100.");
    }
    if (outputPath.empty())
    {
        NS_FATAL_ERROR("La ruta de salida de métricas no puede estar vacía.");
    }

    g_outputPath = outputPath;
    const auto now = std::chrono::system_clock::now().time_since_epoch();
    g_runId = std::to_string(
        std::chrono::duration_cast<std::chrono::milliseconds>(now).count());

    GlobalValue::Bind("SimulatorImplementationType",
                      StringValue("ns3::RealtimeSimulatorImpl"));

    NodeContainer nodes;
    nodes.Create(4);

    MobilityHelper mobility;
    Ptr<ListPositionAllocator> positions = CreateObject<ListPositionAllocator>();
    positions->Add(Vector(-1.05, 0.72, 1.19));
    positions->Add(Vector(-3.52, 1.12, 1.32));
    positions->Add(Vector(1.2, 2.4, -0.84));
    positions->Add(Vector(2.8, 0.38, 0.0));
    mobility.SetPositionAllocator(positions);
    mobility.SetMobilityModel("ns3::ConstantPositionMobilityModel");
    mobility.Install(nodes);

    InternetStackHelper internet;
    internet.Install(nodes);

    PointToPointHelper pointToPoint;
    pointToPoint.SetDeviceAttribute("DataRate", StringValue("5Mbps"));
    pointToPoint.SetChannelAttribute("Delay", StringValue("2ms"));

    const std::vector<std::pair<uint32_t, uint32_t>> edges = {{0, 2}, {1, 2}, {2, 3}};
    const std::vector<std::string> networks = {"10.0.1.0", "10.0.2.0", "10.0.3.0"};
    for (std::size_t index = 0; index < edges.size(); ++index)
    {
        NodeContainer endpoints;
        endpoints.Add(nodes.Get(edges[index].first));
        endpoints.Add(nodes.Get(edges[index].second));
        NetDeviceContainer devices = pointToPoint.Install(endpoints);
        SetLinkErrorModel(devices, lossPercent / 100.0);

        Ipv4AddressHelper addresses;
        addresses.SetBase(networks[index].c_str(), "255.255.255.0");
        addresses.Assign(devices);
    }
    Ipv4GlobalRoutingHelper::PopulateRoutingTables();

    UdpEchoServerHelper server(9000);
    ApplicationContainer serverApps = server.Install(nodes.Get(3));
    serverApps.Start(Seconds(0.1));
    serverApps.Stop(Seconds(g_durationSeconds + 0.05));

    const Ipv4Address gatewayAddress =
        nodes.Get(3)->GetObject<Ipv4>()->GetAddress(1, 0).GetLocal();
    const std::vector<std::string> origins = {"yl69", "dht11", "esp32"};
    for (uint32_t index = 0; index < origins.size(); ++index)
    {
        Ptr<SiriawMeshTrafficApp> app = CreateObject<SiriawMeshTrafficApp>();
        app->Setup(gatewayAddress, 9000, origins[index], Seconds(1.0));
        nodes.Get(index)->AddApplication(app);
        app->SetStartTime(Seconds(1.0));
        app->SetStopTime(Seconds(g_durationSeconds));
    }

    FlowMonitorHelper flowMonitorHelper;
    g_flowMonitor = flowMonitorHelper.InstallAll();
    g_flowClassifier =
        DynamicCast<Ipv4FlowClassifier>(flowMonitorHelper.GetClassifier());
    if (!g_flowClassifier)
    {
        NS_FATAL_ERROR("No se pudo inicializar el clasificador IPv4 de FlowMonitor.");
    }

    Simulator::Schedule(Seconds(1.0), &PublishMetrics);
    Simulator::Stop(Seconds(g_durationSeconds + 0.1));
    Simulator::Run();
    g_flowMonitor->CheckForLostPackets();
    g_simulationComplete = true;
    WriteMetricsSnapshot();
    Simulator::Destroy();
    return 0;
}
