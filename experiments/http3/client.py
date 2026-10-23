import argparse
import asyncio
import json
import math
import ssl
import statistics
import time

from aioquic.asyncio import QuicConnectionProtocol, connect
from aioquic.h3.connection import H3_ALPN, H3Connection
from aioquic.h3.events import DataReceived, HeadersReceived
from aioquic.quic.configuration import QuicConfiguration


class TelemetryClientProtocol(QuicConnectionProtocol):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.http = H3Connection(self._quic)
        self.response = None
        self.status = None
        self.body = bytearray()

    def quic_event_received(self, event):
        for http_event in self.http.handle_event(event):
            if isinstance(http_event, HeadersReceived):
                for name, value in http_event.headers:
                    if name == b":status":
                        self.status = int(value)
            elif isinstance(http_event, DataReceived):
                self.body.extend(http_event.data)
                if http_event.stream_ended and self.response and not self.response.done():
                    self.response.set_result((self.status, bytes(self.body)))

    async def post_telemetry(self, payload):
        self.response = asyncio.get_running_loop().create_future()
        self.status = None
        self.body = bytearray()
        stream_id = self._quic.get_next_available_stream_id(is_unidirectional=False)
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.http.send_headers(
            stream_id,
            [
                (b":method", b"POST"),
                (b":scheme", b"https"),
                (b":authority", b"localhost"),
                (b":path", b"/telemetry"),
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        )
        self.http.send_data(stream_id, body, end_stream=True)
        self.transmit()
        started = time.perf_counter()
        status, response_body = await asyncio.wait_for(self.response, timeout=10)
        elapsed_ms = (time.perf_counter() - started) * 1000
        if status != 200:
            raise RuntimeError(f"HTTP/3 server returned {status}: {response_body.decode(errors='replace')}")
        return elapsed_ms, len(body)


async def run_http3(host, port, count, interval_ms):
    configuration = QuicConfiguration(is_client=True, alpn_protocols=H3_ALPN)
    configuration.server_name = "localhost"
    configuration.verify_mode = ssl.CERT_NONE
    measurements = []
    async with connect(
        host,
        port,
        configuration=configuration,
        create_protocol=TelemetryClientProtocol,
    ) as protocol:
        for sequence in range(1, count + 1):
            elapsed_ms, payload_bytes = await protocol.post_telemetry(
                {"nodoId": "lab-pc", "secuencia": sequence, "temperatura": 22.5, "humedadSuelo": 48}
            )
            measurements.append(elapsed_ms)
            print(json.dumps({"protocol": "QUIC_HTTP3", "sequence": sequence, "rttMs": round(elapsed_ms, 3)}))
            if interval_ms and sequence < count:
                await asyncio.sleep(interval_ms / 1000)
    return measurements, payload_bytes


def percentile(values, percent):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, math.ceil(percent * len(ordered)) - 1))]


def main():
    parser = argparse.ArgumentParser(description="Send sample telemetry over QUIC/HTTP/3.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4433)
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument("--interval-ms", type=int, default=100)
    args = parser.parse_args()
    if args.count < 1 or args.interval_ms < 0:
        parser.error("--count debe ser positivo y --interval-ms no puede ser negativo")
    measurements, payload_bytes = asyncio.run(
        run_http3(args.host, args.port, args.count, args.interval_ms)
    )
    print(json.dumps({
        "summary": "QUIC_HTTP3",
        "requests": len(measurements),
        "payloadBytes": payload_bytes,
        "meanRttMs": round(statistics.mean(measurements), 3),
        "p50RttMs": round(percentile(measurements, 0.50), 3),
        "p95RttMs": round(percentile(measurements, 0.95), 3),
    }))


if __name__ == "__main__":
    main()
