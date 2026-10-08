"""Opt-in Microsoft Foundry v1 REST adapter. Tests never call a paid endpoint."""

import asyncio
from dataclasses import dataclass, field
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .pipeline import explain, insights


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Foundry redirects are not permitted")


def output_schema(example: object) -> dict:
    if isinstance(example, dict):
        return {"type": "object", "properties": {key: output_schema(value) for key, value in example.items()},
                "required": list(example), "additionalProperties": False}
    if isinstance(example, list):
        return {"type": "array", "items": output_schema(example[0]) if example else {"type": "string"}}
    if isinstance(example, bool):
        return {"type": "boolean"}
    if isinstance(example, int):
        return {"type": "integer"}
    return {"type": "string"}


@dataclass(frozen=True)
class FoundryBackend:
    endpoint: str
    deployment: str
    api_key: str = field(repr=False)
    timeout_seconds: float = 4.0

    def __post_init__(self) -> None:
        url = urlparse(self.endpoint)
        if (url.scheme != "https" or not url.hostname
                or not url.hostname.endswith((".openai.azure.com", ".services.ai.azure.com"))
                or url.username or url.password or url.query or url.fragment
                or url.port not in (None, 443) or url.path.rstrip("/") not in ("", "/openai/v1")):
            raise ValueError("Use a public Azure model resource HTTPS endpoint, not a Foundry project endpoint")
        if not self.deployment or not self.api_key or not 0 < self.timeout_seconds <= 10:
            raise ValueError("Foundry deployment, key and bounded timeout are required")

    @classmethod
    def from_environment(cls) -> "FoundryBackend":
        return cls(endpoint=os.getenv("PULSE_FOUNDRY_ENDPOINT", ""),
                   deployment=os.getenv("PULSE_FOUNDRY_DEPLOYMENT", ""),
                   api_key=os.getenv("PULSE_FOUNDRY_API_KEY", ""))

    async def complete(self, role: str, prompt: str, payload: dict[str, object]) -> dict[str, object]:
        return await asyncio.to_thread(self._complete, role, prompt, payload)

    def _complete(self, role: str, prompt: str, payload: dict[str, object]) -> dict[str, object]:
        if role == "explainer":
            example = explain(payload["factPack"])
        elif role == "narrator":
            example = insights(payload["request"])["draft"]
        elif role == "verifier":
            draft = payload["draft"]
            example = {"schemaVersion": "2.0.0", "draftId": draft["id"], "status": "VERIFIED",
                       "claimsChecked": 1, "claimsPassed": 1,
                       "claims": [{"claimId": draft["claims"][0]["id"], "supported": True,
                                   "eventIds": draft["claims"][0]["eventIds"], "reason": "Supported by the supplied fact"}]}
        else:
            raise ValueError("Unknown agent role")
        body = {"model": self.deployment,
                "messages": [{"role": "system", "content": prompt},
                             {"role": "user", "content": json.dumps(payload, allow_nan=False)}],
                "max_completion_tokens": 2048,
                "response_format": {"type": "json_schema", "json_schema": {
                    "name": f"pulse_{role}", "strict": True, "schema": output_schema(example)}}}
        base = self.endpoint.rstrip("/")
        if not base.endswith("/openai/v1"):
            base += "/openai/v1"
        request = Request(base + "/chat/completions", data=json.dumps(body).encode(),
                          headers={"Content-Type": "application/json", "api-key": self.api_key})
        try:
            with build_opener(NoRedirect()).open(request, timeout=self.timeout_seconds) as response:
                raw = response.read(65537)
            if len(raw) > 65536:
                raise ValueError("Oversized Foundry response")
            completion = json.loads(raw)
            choice = completion["choices"][0]
            if choice["finish_reason"] != "stop" or choice["message"].get("refusal"):
                raise ValueError("Foundry returned an incomplete or refused response")
            result = json.loads(choice["message"]["content"])
            if not isinstance(result, dict):
                raise ValueError("Foundry did not return a JSON object")
            return result
        except HTTPError as error:
            code = error.code
            error.close()
            raise RuntimeError(f"Foundry HTTP {code}; check endpoint, model, quota and credentials") from None
        except URLError:
            raise RuntimeError("Foundry connection failed") from None
        except (IndexError, KeyError, TypeError):
            raise ValueError("Malformed Foundry completion response") from None
