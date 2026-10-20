"""Reviewed, fact-bound agent outputs for a demo with no runtime model calls."""

from pathlib import Path
import json

from .contracts import InsightRequest, InsightResponse, SCHEMA_VERSION
from .pipeline import validate_request
from .publication import (publication_reason, validate_publishable_draft,
                          validate_publishable_verification)


def load_recordings(directory: Path) -> list[tuple[InsightRequest, InsightResponse]]:
    files = sorted(directory.glob("*.json"))
    if not files or len(files) > 128:
        raise ValueError("Recorded mode requires 1 to 128 reviewed JSON recordings")
    recordings: list[tuple[InsightRequest, InsightResponse]] = []
    seen: set[str] = set()
    for file in files:
        if file.stat().st_size > 131072:
            raise ValueError("Oversized insight recording")
        record = json.loads(file.read_text(encoding="utf-8"))
        if not isinstance(record, dict) or set(record) != {"request", "response", "provenance"}:
            raise ValueError("Invalid recording envelope")
        request, response = record["request"], record["response"]
        validate_request(request)
        if set(response) != {"schemaVersion", "draft", "verification"} or response["schemaVersion"] != SCHEMA_VERSION:
            raise ValueError("Invalid recorded response fields")
        validate_publishable_draft(request, response["draft"])
        validate_publishable_verification(response["draft"], response["verification"])
        if any(item["reason"] != publication_reason(request["factPack"]) for item in response["verification"]["claims"]):
            raise ValueError("Recording includes unchecked verifier prose")
        provenance = record["provenance"]
        if (not isinstance(provenance, dict) or provenance.get("provider") != "Microsoft Foundry"
                or not isinstance(provenance.get("deployment"), str) or not provenance["deployment"]
                or not isinstance(provenance.get("recordedAt"), str) or not provenance["recordedAt"]):
            raise ValueError("Recording requires reviewed provider/deployment provenance")
        key = json.dumps(request, sort_keys=True, allow_nan=False)
        if key in seen:
            raise ValueError("Duplicate recorded request")
        seen.add(key)
        recordings.append((request, response))
    return recordings
