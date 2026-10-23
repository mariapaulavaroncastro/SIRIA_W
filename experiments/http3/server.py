import argparse
import asyncio
import json
import ssl
import time
from collections import defaultdict

from aioquic.asyncio import QuicConnectionProtocol, serve
from aioquic.h3.connection import H3_ALPN, H3Connection
from aioquic.h3.events import DataReceived, HeadersReceived
from aioquic.quic.configuration import QuicConfiguration


class TelemetryProtocol(QuicConnectionProtocol):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.http = H3Connection(self._quic)
        self.headers = {}
        self.bodies = defaultdict(bytearray)

    def quic_event_received(self, event):
        for http_event in self.http.handle_event(event):
            if isinstance(http_event, HeadersReceived):
                self.headers[http_event.stream_id] = dict(http_event.headers)
            elif isinstance(http_event, DataReceived):
                body = self.bodies[http_event.stream_id]
                body.extend(http_event.data)
                if len(body) > 4096:
                    self.respond(http_event.stream_id, 413, {"error": "payload exceeds 4096 bytes"})
                elif http_event.stream_ended:
                    self.handle_request(http_event.stream_id, bytes(body))

    def handle_request(self, stream_id, body):
        path = self.headers.get(stream_id, {}).get(b":path", b"").decode("ascii", "replace")
        if path != "/telemetry":
            self.respond(stream_id, 404, {"error": "use POST /telemetry"})
            return
        try:
            telemetry = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.respond(stream_id, 400, {"error": "invalid JSON"})
            return
        if not isinstance(telemetry, dict):
            self.respond(stream_id, 400, {"error": "JSON body must be an object"})
            return
        response = {
            "accepted": True,
            "payloadBytes": len(body),
            "receivedAtUnixMs": int(time.time() * 1000),
        }
        print(json.dumps({"event": "telemetry_received", "payloadBytes": len(body)}), flush=True)
        self.respond(stream_id, 200, response)

    def respond(self, stream_id, status, value):
        body = json.dumps(value, separators=(",", ":")).encode()
        self.http.send_headers(
            stream_id,
            [(b":status", str(status).encode()), (b"content-type", b"application/json")],
        )
        self.http.send_data(stream_id, body, end_stream=True)
        self.transmit()
        self.headers.pop(stream_id, None)
        self.bodies.pop(stream_id, None)


async def run(host, port, certificate, private_key):
    configuration = QuicConfiguration(is_client=False, alpn_protocols=H3_ALPN)
    configuration.load_cert_chain(certificate, private_key)
    server = await serve(
        host,
        port,
        configuration=configuration,
        create_protocol=TelemetryProtocol,
    )
    print(f"HTTP/3 experimental server listening on https://{host}:{port}", flush=True)
    try:
        await asyncio.Future()
    finally:
        server.close()


def main():
    parser = argparse.ArgumentParser(description="Local QUIC/HTTP/3 telemetry experiment.")
    parser.add_argument("--host", default="127.0.0.1", help="Defaults to loopback; use only in a trusted lab.")
    parser.add_argument("--port", type=int, default=4433)
    parser.add_argument("--certificate", required=True)
    parser.add_argument("--private-key", required=True)
    args = parser.parse_args()
    asyncio.run(run(args.host, args.port, args.certificate, args.private_key))


if __name__ == "__main__":
    main()
