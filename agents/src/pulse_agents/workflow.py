"""Bounded three-agent orchestration with independent publishing checks."""

import asyncio
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, cast

from .contracts import (Claim, InsightRequest, InsightResponse, NarrationDraft,
                        VerificationResult, validate_draft)
from .pipeline import insights
from .publication import (PUBLICATION_REASON, approved_wordings, validate_publishable_draft,
                          validate_publishable_verification)

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


async def run_agents(request: InsightRequest, backend: AgentBackend,
                     timeout_seconds: float = 2.0, *, publish: bool = True) -> ShadowRun:
    """Publish only approved language with a complete independently checked claim."""
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
                    "approvedWordings": list(approved_wordings(request["persona"])) if publish else [template["draft"]["text"]],
                }))
                validate_draft(candidate, request["factPack"])
                validate_publishable_draft(request, candidate)
                if not publish and candidate != template["draft"]:
                    raise ValueError("Narration differs from the deterministically supported template")
                verification = cast(VerificationResult, await call("verifier", {
                    "draft": candidate, "factPack": request["factPack"],
                }))
                validate_publishable_verification(candidate, verification)
                # Verifier prose is diagnostic, not an additional publishable claim.
                verification = deepcopy(verification)
                for item in verification["claims"]:
                    item["reason"] = PUBLICATION_REASON
                response: InsightResponse = {"schemaVersion": template["schemaVersion"],
                                             "draft": candidate, "verification": verification}
                return ShadowRun(response if publish else template, candidate, True, attempts, tuple(reasons))
            except (ValueError, KeyError, TypeError, AttributeError) as error:
                reasons.append(f"Narrator attempt {attempts}: {error}")
    except (TimeoutError, OSError, ValueError, KeyError, TypeError, AttributeError, RuntimeError) as error:
        reasons.append(f"Agent workflow failed: {error}")
    return ShadowRun(template, candidate, False, attempts, tuple(reasons))


async def run_shadow(request: InsightRequest, backend: AgentBackend,
                     timeout_seconds: float = 2.0) -> ShadowRun:
    """Retain the original template-only diagnostic mode."""
    return await run_agents(request, backend, timeout_seconds, publish=False)
