"""Local HTTP adapter; template default, explicit opt-in Foundry modes."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import logging
import os
from pathlib import Path
from typing import Any

from .pipeline import insights
from .service import AgentService


def reject_constant(value: str) -> None:
    raise ValueError(f"Nonfinite JSON constant: {value}")


def model_request_cap() -> int:
    """Paid workflows allowed per process; unset or invalid means none."""
    raw = os.getenv("PULSE_MODEL_REQUEST_CAP")
    if raw is None:
        return 0
    try:
        cap = int(raw)
    except ValueError:
        cap = -1
    if not 0 <= cap <= 100:
        logging.warning("PULSE_MODEL_REQUEST_CAP=%r is not an integer from 0 to 100; using 0", raw)
        return 0
    return cap


class Handler(BaseHTTPRequestHandler):
    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(5)

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        service = getattr(self.server, "service", None)
        self.send_header("X-Pulse-Agent-Mode", service.mode if service else "template")
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
        token = getattr(self.server, "auth_token", "")
        if token and not hmac.compare_digest(self.headers.get("Authorization", "").encode(), f"Bearer {token}".encode()):
            # Drain bounded bytes, without decoding, to avoid an HTTP/TCP reset.
            try:
                length = min(max(int(self.headers.get("Content-Length", "0")), 0), 65536)
                self.rfile.read(length)
            except (ValueError, OSError):
                pass
            self.send_json(401, {"error": "Unauthorized"})
            self.close_connection = True
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
    parser.add_argument("--mode", choices=("template", "recorded", "foundry-shadow", "foundry"), default=os.getenv("PULSE_AGENT_MODE", "template"))
    parser.add_argument("--recordings", default=os.getenv("PULSE_RECORDINGS_DIR", "agents/recordings"))
    args = parser.parse_args()
    token = os.getenv("PULSE_AGENT_AUTH_TOKEN", "")
    if os.getenv("PULSE_REQUIRE_AUTH") == "1" and not token:
        raise ValueError("PULSE_AGENT_AUTH_TOKEN is required for protected hosting")
    if token and (len(token) != 64 or any(char not in "0123456789abcdef" for char in token)):
        raise ValueError("Service auth token must contain 64 lowercase hex characters")
    with ThreadingHTTPServer((args.host, args.port), Handler) as server:
        server.auth_token = token
        logging.basicConfig(level=logging.INFO, format="%(message)s")
        backend = None
        recordings = None
        if args.mode == "recorded":
            from .recordings import load_recordings
            recordings = load_recordings(Path(args.recordings))
        if args.mode in ("foundry-shadow", "foundry"):
            from .foundry import FoundryBackend
            backend = FoundryBackend.from_environment()
        server.service = AgentService(backend, max_requests=model_request_cap(),
                                      publish=args.mode == "foundry", recordings=recordings)
        print(f"Pulse insights ({server.service.mode}): http://{args.host}:{args.port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
