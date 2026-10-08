"""Three replaceable stages for the template-only golden path, not LLM agents."""

import math

from .contracts import (Claim, FactPack, InsightRequest, InsightResponse,
                        NarrationDraft, VerificationResult, SCHEMA_VERSION,
                        validate_draft, validate_verification, valid_id)


def validate_request(request: InsightRequest) -> None:
    if set(request) != {"schemaVersion", "factPack", "locale", "persona"}:
        raise ValueError("Invalid request fields")
    if (request["schemaVersion"] != SCHEMA_VERSION or request["locale"] != "en-GB"
            or request["persona"] not in ("CASUAL", "ANALYST")):
        raise ValueError("Only English CASUAL/ANALYST templates are available")
    pack = request["factPack"]
    required = {"schemaVersion", "id", "matchId", "period", "windowStartMs", "windowEndMs", "facts"}
    if not isinstance(pack, dict) or set(pack) != required:
        raise ValueError("Invalid fact-pack fields")
    if (pack["schemaVersion"] != SCHEMA_VERSION or not valid_id(pack["id"])
            or not valid_id(pack["matchId"]) or type(pack["period"]) is not int
            or not 1 <= pack["period"] <= 4
            or type(pack["windowStartMs"]) is not int or type(pack["windowEndMs"]) is not int
            or not 0 <= pack["windowStartMs"] <= pack["windowEndMs"]
            or not isinstance(pack["facts"], list) or not pack["facts"]):
        raise ValueError("Invalid fact-pack identity or window")
    seen: set[str] = set()
    for fact in pack["facts"]:
        required_fact = {"id", "metric", "value", "unit", "teamId", "timeStartMs", "timeEndMs", "eventIds"}
        if not isinstance(fact, dict) or not required_fact <= set(fact) or set(fact) - required_fact - {"attributes"}:
            raise ValueError("Invalid fact fields")
        if (not valid_id(fact["id"]) or fact["id"] in seen or not valid_id(fact["teamId"])
                or not isinstance(fact["metric"], str) or not fact["metric"]
                or not isinstance(fact["unit"], str) or not fact["unit"]
                or type(fact["value"]) not in (int, float, str)
                or (type(fact["value"]) is float and not math.isfinite(fact["value"]))
                or type(fact["timeStartMs"]) is not int or type(fact["timeEndMs"]) is not int
                or not pack["windowStartMs"] <= fact["timeStartMs"] <= fact["timeEndMs"] <= pack["windowEndMs"]
                or not isinstance(fact["eventIds"], list) or not fact["eventIds"]
                or len(set(fact["eventIds"])) != len(fact["eventIds"])
                or not all(valid_id(event_id) for event_id in fact["eventIds"])):
            raise ValueError("Invalid fact or evidence")
        if "attributes" in fact:
            attrs = fact["attributes"]
            if not isinstance(attrs, dict) or any(type(value) not in (str, int, float, bool) or (type(value) is float and not math.isfinite(value)) for value in attrs.values()):
                raise ValueError("Invalid fact attributes")
        seen.add(fact["id"])


def explain(pack: FactPack) -> Claim:
    facts = [fact for fact in pack["facts"] if fact["metric"] == "set_piece_shots"]
    if len(facts) != 1:
        raise ValueError("Exactly one corner-shot fact is required")
    fact = facts[0]
    if type(fact["value"]) not in (int, float) or fact["value"] != 1 or fact["unit"] != "shots" or len(fact["eventIds"]) != 2:
        raise ValueError("Unsupported corner-shot fact")
    return {"id": "claim-" + fact["id"], "text": "The corner produced 1 shot.",
            "factIds": [fact["id"]], "eventIds": list(fact["eventIds"])}


def narrate(request: InsightRequest, claim: Claim) -> NarrationDraft:
    text = claim["text"] if request["persona"] == "CASUAL" else "Set-piece sequence: 1 shot following the corner."
    return {"schemaVersion": SCHEMA_VERSION, "id": "draft-" + request["factPack"]["id"],
            "factPackId": request["factPack"]["id"], "locale": request["locale"],
            "persona": request["persona"], "text": text,
            "claims": [{**claim, "text": text}]}


def verify_template(draft: NarrationDraft, pack: FactPack) -> VerificationResult:
    validate_draft(draft, pack)
    expected = narrate({"schemaVersion": SCHEMA_VERSION, "factPack": pack,
                        "locale": draft["locale"], "persona": draft["persona"]}, explain(pack))
    if draft != expected:
        raise ValueError("Draft differs from the trusted template")
    result: VerificationResult = {"schemaVersion": SCHEMA_VERSION, "draftId": draft["id"],
                                 "status": "FALLBACK_TEMPLATE", "claimsChecked": 0,
                                 "claimsPassed": 0, "claims": []}
    validate_verification(result, draft)
    return result


def insights(request: InsightRequest) -> InsightResponse:
    validate_request(request)
    claim = explain(request["factPack"])
    draft = narrate(request, claim)
    verification = verify_template(draft, request["factPack"])
    return {"schemaVersion": SCHEMA_VERSION, "draft": draft, "verification": verification}
