"""Offline/shadow agent orchestration. No model output is published to viewers."""

import asyncio
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, cast

from .contracts import (Claim, InsightRequest, InsightResponse, NarrationDraft,
                        VerificationResult, validate_draft, validate_verification)
from .pipeline import insights

PROMPTS = Path(__file__).parent / "prompts"


class AgentBackend(Protocol):
    async def complete(self, role: str, prompt: str,
                       payload: dict[str, object]) -> dict[str, object]:
        """Return structured JSON. An adapter owns model credentials and transport."""
        ...


@dataclass(frozen=True)
class ShadowRun:
    response: InsightResponse
    candidate: NarrationDraft | None
    accepted: bool
    narrator_attempts: int
    reasons: tuple[str, ...]


async def run_shadow(request: InsightRequest, backend: AgentBackend,
                     timeout_seconds: float = 2.0) -> ShadowRun:
    """Exercise three replaceable agents, retry narration once, always ship template.

    Until broader deterministic language checks and the Go gate are agreed,
    only canonical wording qualifies even for shadow acceptance. A model's
    VERIFIED label alone never establishes correctness.
    """
    if not 0 < timeout_seconds <= 10:
        raise ValueError("Agent timeout must be between zero and ten seconds")
    template = insights(request)
    reasons: list[str] = []
    candidate: NarrationDraft | None = None
    attempts = 0

    async def call(role: str, payload: dict[str, object]) -> dict[str, object]:
        prompt = (PROMPTS / f"{role}.txt").read_text(encoding="utf-8")
        result = await asyncio.wait_for(
            backend.complete(role, prompt, deepcopy(payload)), timeout_seconds)
        if not isinstance(result, dict):
            raise ValueError(f"{role} did not return a JSON object")
        return result

    try:
        explanation = cast(Claim, await call("explainer", {"factPack": request["factPack"]}))
        # This first scenario has one supported claim; do not allow an invented
        # explanation to become the narrator's source material.
        expected_claim = template["draft"]["claims"][0]
        expected_casual = {**expected_claim, "text": "The corner produced 1 shot."}
        if explanation != expected_casual:
            raise ValueError("Explainer differs from the supported corner-shot claim")
        for attempts in (1, 2):
            try:
                candidate = cast(NarrationDraft, await call("narrator", {
                    "request": request, "explanation": explanation,
                    "rejectionReasons": list(reasons),
                }))
                validate_draft(candidate, request["factPack"])
                if candidate != template["draft"]:
                    raise ValueError("Narration differs from the deterministically supported template")
                verification = cast(VerificationResult, await call("verifier", {
                    "draft": candidate, "factPack": request["factPack"],
                }))
                if set(verification) != {"schemaVersion", "draftId", "status", "claimsChecked", "claimsPassed", "claims"}:
                    raise ValueError("Invalid verifier fields")
                if not isinstance(verification["claims"], list) or any(
                    not isinstance(item, dict)
                    or set(item) != {"claimId", "supported", "eventIds", "reason"}
                    or not isinstance(item["reason"], str)
                    or not isinstance(item["eventIds"], list)
                    for item in verification["claims"]
                ):
                    raise ValueError("Invalid verifier claim fields")
                validate_verification(verification, candidate)
                if verification["status"] != "VERIFIED":
                    raise ValueError("Verifier rejected the candidate")
                # Require the full evidence set, not merely a subset of IDs.
                claims = {claim["id"]: claim for claim in candidate["claims"]}
                for item in verification["claims"]:
                    if set(item["eventIds"]) != set(claims[item["claimId"]]["eventIds"]):
                        raise ValueError("Verifier omitted supporting evidence")
                return ShadowRun(template, candidate, True, attempts, tuple(reasons))
            except (ValueError, KeyError, TypeError, AttributeError) as error:
                reasons.append(f"Narrator attempt {attempts}: {error}")
    except (TimeoutError, OSError, ValueError, KeyError, TypeError, AttributeError, RuntimeError) as error:
        reasons.append(f"Agent workflow failed: {error}")
    return ShadowRun(template, candidate, False, attempts, tuple(reasons))
