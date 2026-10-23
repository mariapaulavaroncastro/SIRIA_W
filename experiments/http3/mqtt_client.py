import argparse
import json
import os
import statistics
import time

import paho.mqtt.client as mqtt


def main():
    parser = argparse.ArgumentParser(description="Measure MQTT QoS 1 broker acknowledgements as a lab baseline.")
    parser.add_argument("--host", default=os.getenv("SIRIA_MQTT_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("SIRIA_MQTT_PORT", "1883")))
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument("--interval-ms", type=int, default=100)
    parser.add_argument("--topic", default="siria/experimento/g6/telemetria")
    args = parser.parse_args()
    if args.count < 1 or args.interval_ms < 0:
        parser.error("--count debe ser positivo y --interval-ms no puede ser negativo")

    username = os.getenv("SIRIA_MQTT_USERNAME")
    password = os.getenv("SIRIA_MQTT_PASSWORD")
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="siria-g6-lab")
    if username:
        client.username_pw_set(username, password)
    client.connect(args.host, args.port, keepalive=30)
    client.loop_start()
    latencies = []
    try:
        for sequence in range(1, args.count + 1):
            payload = json.dumps({
                "nodoId": "lab-pc",
                "secuencia": sequence,
                "temperatura": 22.5,
                "humedadSuelo": 48,
            }, separators=(",", ":"))
            started = time.perf_counter()
            info = client.publish(args.topic, payload, qos=1)
            if info.rc != mqtt.MQTT_ERR_SUCCESS:
                raise RuntimeError(f"MQTT publish failed with code {info.rc}")
            info.wait_for_publish(timeout=10)
            if not info.is_published():
                raise TimeoutError("No llegó PUBACK MQTT QoS 1 en 10 segundos")
            elapsed_ms = (time.perf_counter() - started) * 1000
            latencies.append(elapsed_ms)
            print(json.dumps({
                "protocol": "MQTT_QOS1",
                "sequence": sequence,
                "brokerPubAckMs": round(elapsed_ms, 3),
            }))
            if args.interval_ms and sequence < args.count:
                time.sleep(args.interval_ms / 1000)
    finally:
        client.disconnect()
        client.loop_stop()

    ordered = sorted(latencies)
    print(json.dumps({
        "summary": "MQTT_QOS1_BROKER_ACK",
        "requests": len(latencies),
        "meanBrokerPubAckMs": round(statistics.mean(latencies), 3),
        "p50BrokerPubAckMs": round(ordered[int((len(ordered) - 1) * 0.50)], 3),
        "p95BrokerPubAckMs": round(ordered[int((len(ordered) - 1) * 0.95)], 3),
    }))


if __name__ == "__main__":
    main()
