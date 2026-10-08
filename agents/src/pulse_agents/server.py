"""Local HTTP adapter; template default, explicit opt-in Foundry shadow mode."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
import os
from typing import Any

from .pipeline import insights
from .service import AgentService


def reject_constant(value: str) -> None:
    raise ValueError(f"Nonfinite JSON constant: {value}")


class Handler(BaseHTTPRequestHandler):
    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(5)

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        service = getattr(self.server, "service", None)
        self.send_json(200 if self.path == "/healthz" else 404,
                       {"status": "ok", "mode": service.mode if service else "template"} if self.path == "/healthz" else {"error": "Not found"})

    def do_POST(self) -> None:
        if self.path != "/insights":
            self.send_json(404, {"error": "Not found"})
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "Expected application/json"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Invalid content length"})
            return
        if not 0 < length <= 65536:
            self.send_json(413, {"error": "Request must contain at most 65536 bytes"})
            return
        try:
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError("Incomplete request body")
            request = json.loads(raw, parse_constant=reject_constant)
            service = getattr(self.server, "service", None)
            self.send_json(200, service.respond(request) if service else insights(request))
        except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
            self.send_json(422, {"error": "Invalid or unsupported insight request"})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--mode", choices=("template", "foundry-shadow"), default=os.getenv("PULSE_AGENT_MODE", "template"))
    args = parser.parse_args()
    with ThreadingHTTPServer((args.host, args.port), Handler) as server:
        logging.basicConfig(level=logging.INFO, format="%(message)s")
        backend = None
        if args.mode == "foundry-shadow":
            from .foundry import FoundryBackend
            backend = FoundryBackend.from_environment()
        server.service = AgentService(backend, max_requests=int(os.getenv("PULSE_MODEL_REQUEST_CAP", "10")))
        print(f"Pulse insights ({server.service.mode}): http://{args.host}:{args.port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
