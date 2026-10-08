"""Contract v2 models and deterministic checks; no model calls or dependencies."""

import re
from typing import Literal, NotRequired, TypedDict

SCHEMA_VERSION = "2.0.0"


class Fact(TypedDict):
    id: str
    metric: str
    value: float | str
    unit: str
    teamId: str
    timeStartMs: int
    timeEndMs: int
    eventIds: list[str]
    attributes: NotRequired[dict[str, str | float | bool]]


class FactPack(TypedDict):
    schemaVersion: str
    id: str
    matchId: str
    period: int
    windowStartMs: int
    windowEndMs: int
    facts: list[Fact]


class Claim(TypedDict):
    id: str
    text: str
    factIds: list[str]
    eventIds: list[str]


class NarrationDraft(TypedDict):
    schemaVersion: str
    id: str
    factPackId: str
    locale: Literal["en-GB", "sw-KE"]
    persona: Literal["CASUAL", "ANALYST"]
    text: str
    claims: list[Claim]


class ClaimResult(TypedDict):
    claimId: str
    supported: bool
    eventIds: list[str]
    reason: str


class VerificationResult(TypedDict):
    schemaVersion: str
    draftId: str
    status: Literal["VERIFIED", "REJECTED", "FALLBACK_TEMPLATE"]
    claimsChecked: int
    claimsPassed: int
    claims: list[ClaimResult]


class InsightRequest(TypedDict):
    schemaVersion: str
    factPack: FactPack
    locale: Literal["en-GB", "sw-KE"]
    persona: Literal["CASUAL", "ANALYST"]


class InsightResponse(TypedDict):
    schemaVersion: str
    draft: NarrationDraft
    verification: VerificationResult


class OverlayCue(TypedDict):
    schemaVersion: str
    id: str
    matchId: str
    period: int
    startMs: int
    endMs: int
    replayStartMs: int
    replayEndMs: int
    locale: Literal["en-GB", "sw-KE"]
    persona: Literal["CASUAL", "ANALYST"]
    kind: Literal["COMMENTARY"]
    verification: VerificationResult
    priority: int
    text: str
    factIds: list[str]
    eventIds: list[str]


class CueFeed(TypedDict):
    schemaVersion: str
    cues: list[OverlayCue]


def valid_id(value: str) -> bool:
    return re.fullmatch(r"[A-Za-z0-9_.:-]{1,64}", value) is not None


def unique_ids(values: list[str]) -> bool:
    return bool(values) and len(set(values)) == len(values) and all(map(valid_id, values))


def validate_draft(draft: NarrationDraft, pack: FactPack) -> None:
    if (draft["schemaVersion"] != SCHEMA_VERSION or not valid_id(draft["id"])
            or draft["factPackId"] != pack["id"]
            or draft["locale"] not in ("en-GB", "sw-KE")
            or draft["persona"] not in ("CASUAL", "ANALYST")
            or not 1 <= len(draft["text"]) <= 240 or not draft["claims"]):
        raise ValueError("Invalid narration draft")
    facts = {fact["id"]: fact for fact in pack["facts"]}
    seen: set[str] = set()
    for claim in draft["claims"]:
        if (not valid_id(claim["id"]) or claim["id"] in seen
                or not 1 <= len(claim["text"]) <= 240
                or not unique_ids(claim["factIds"]) or not unique_ids(claim["eventIds"])):
            raise ValueError("Invalid claim")
        seen.add(claim["id"])
        evidence: set[str] = set()
        for fact_id in claim["factIds"]:
            if fact_id not in facts:
                raise ValueError("Unknown fact")
            evidence.update(facts[fact_id]["eventIds"])
        if not set(claim["eventIds"]) <= evidence:
            raise ValueError("Unsupported evidence")


def validate_verification(result: VerificationResult, draft: NarrationDraft) -> None:
    checked, passed = result["claimsChecked"], result["claimsPassed"]
    if (result["schemaVersion"] != SCHEMA_VERSION or result["draftId"] != draft["id"]
            or type(checked) is not int or type(passed) is not int
            or not 0 <= passed <= checked or checked != len(result["claims"])):
        raise ValueError("Invalid verification counts or identity")
    if result["status"] == "FALLBACK_TEMPLATE":
        if checked != 0 or passed != 0:
            raise ValueError("Fallback cannot claim model verification")
        return
    if result["status"] not in ("VERIFIED", "REJECTED"):
        raise ValueError("Invalid verification status")
    claims = {claim["id"]: claim for claim in draft["claims"]}
    seen: set[str] = set()
    actual_passed = 0
    for item in result["claims"]:
        claim_id = item["claimId"]
        if claim_id not in claims or claim_id in seen or not item["reason"] or type(item["supported"]) is not bool:
            raise ValueError("Invalid checked claim")
        seen.add(claim_id)
        if item["supported"]:
            if not unique_ids(item["eventIds"]):
                raise ValueError("Supported claim requires evidence")
            actual_passed += 1
        if not set(item["eventIds"]) <= set(claims[claim_id]["eventIds"]):
            raise ValueError("Verification cites unrelated event")
    if actual_passed != passed or len(seen) != len(claims):
        raise ValueError("Verification must check every claim")
    if result["status"] == "VERIFIED" and (passed == 0 or passed != checked):
        raise ValueError("Verified result must pass every claim")
    if result["status"] == "REJECTED" and passed == checked:
        raise ValueError("Rejected result must contain a failed claim")
