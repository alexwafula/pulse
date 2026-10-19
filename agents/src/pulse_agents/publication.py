"""Deterministic publishing policy, independent of a model's approval."""

from copy import deepcopy

from .contracts import FactPack, InsightRequest, NarrationDraft, VerificationResult, validate_verification
from .pipeline import insights
from .patterns import pattern_text

PUBLICATION_REASON = "Supported by the computed corner-shot fact."


def publication_reason(pack: FactPack) -> str:
    if len(pack["facts"]) == 1 and pack["facts"][0]["metric"] == "open_play_passes_before_shot":
        return "Supported by the computed open-play pass-count fact."
    return PUBLICATION_REASON


def approved_wordings(persona: str, pack: FactPack | None = None) -> tuple[str, ...]:
    if pack is not None and len(pack["facts"]) == 1 and pack["facts"][0]["metric"] == "open_play_passes_before_shot":
        text = pattern_text(pack, "en-GB", persona)
        count = int(pack["facts"][0]["value"])
        noun = "pass" if count == 1 else "passes"
        return (text, f"Before the first shot in this open-play window: {count} completed {noun} recorded.")
    if persona == "CASUAL":
        return ("The corner produced 1 shot.",
                "A shot followed the corner: 1 shot in this sequence.",
                "From corner to shot: 1 shot recorded.")
    if persona == "ANALYST":
        return ("Set-piece sequence: 1 shot following the corner.",
                "Corner sequence: 1 recorded shot, supported by the corner and shot events.",
                "The corner-to-shot window contains 1 shot.")
    raise ValueError("Unsupported publishing persona")


def validate_publishable_draft(request: InsightRequest, draft: NarrationDraft) -> None:
    if request["locale"] != "en-GB":
        raise ValueError("Translated locales are template-only pending language review")
    expected = deepcopy(insights(request)["draft"])
    text = draft.get("text")
    if text not in approved_wordings(request["persona"], request["factPack"]):
        raise ValueError("Narration is outside the approved source-backed language")
    expected["text"] = text
    expected["claims"][0]["text"] = text
    if draft != expected:
        raise ValueError("Narration identity, audience, claim or complete evidence differs from the fact pack")


def validate_publishable_verification(draft: NarrationDraft, result: VerificationResult) -> None:
    if set(result) != {"schemaVersion", "draftId", "status", "claimsChecked", "claimsPassed", "claims"}:
        raise ValueError("Invalid verifier fields")
    if not isinstance(result["claims"], list) or any(
        not isinstance(item, dict)
        or set(item) != {"claimId", "supported", "eventIds", "reason"}
        or not isinstance(item["reason"], str) or not item["reason"].strip() or len(item["reason"]) > 240
        or not isinstance(item["eventIds"], list)
        for item in result["claims"]
    ):
        raise ValueError("Invalid verifier claim fields")
    validate_verification(result, draft)
    if result["status"] != "VERIFIED":
        raise ValueError("Verifier rejected the candidate")
    claims = {claim["id"]: claim for claim in draft["claims"]}
    for item in result["claims"]:
        if item["eventIds"] != claims[item["claimId"]]["eventIds"]:
            raise ValueError("Verifier must preserve the complete ordered evidence")
