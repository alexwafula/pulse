# First local insight flow

Date: 2026-10-08

## Decision

Complete one offline golden path before model calls: corner and first shot ->
Go fact pack -> Python template pipeline -> Go cue gate -> browser evidence.
The request/response envelopes are additive contract-v2 messages. No new
dependencies or Azure resources are introduced.

The first-shot detector stops on a new corner, phase change, opposing event,
or 12-second limit. It counts attempts, including blocked shots, not goals.
This is a conservative integration metric, not comprehensive tactical analysis.

Python's separate explain/narrate/verify_template functions are replacement
points for agent work. Outputs use FALLBACK_TEMPLATE and zero model-checked
claims. Only en-GB CASUAL/ANALYST are enabled. The local HTTP adapter uses the
standard library synchronously; it is a development stub, not the planned
async production agent service. It rejects malformed or unsupported requests.

Go recomputes source facts, validates references/timing and requires the exact
canonical template. Labelling arbitrary text FALLBACK_TEMPLATE or VERIFIED
cannot bypass the gate. On service errors, timeout or unsafe responses, Go
builds its own canonical template and passes it through the same gate.

## Delivery and evidence

Go serves computed fact packs and an offline cue feed. No SSE or server-side
live clock is claimed. The browser releases the cue at the shot timestamp.
Evidence playback pins the already-seen insight, runs the source clip at 1x,
highlights both events and stops at the clip end. Return restores the previous
match clock; restarting or seeking clears evidence mode.

## Checks

Go tests cover deterministic facts, phase/opponent/time boundaries, HTTP
handoff, bad-text rejection and fallback. Python tests cover shared positive
and invalid cases plus the real HTTP adapter. Playwright covers cue release,
evidence playback/return/restart and the existing renderer checks. Real models,
prompt evaluation, SSE, Azure deployment and native-reviewed Kiswahili remain
next milestones, not completed work.
