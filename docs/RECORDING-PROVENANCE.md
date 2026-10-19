# Recording provenance audit

Audit date: 2026-10-18. Status: **CONTENT BOUND; PROVIDER PROVENANCE UNCONFIRMED**.
No new model calls were made and the recording has not been changed.

## Oct 19 follow-up and new reference run

The statement above describes the Oct 18 audit. On Oct 19 Alex explicitly approved
a small paid run. The original recording was not overwritten.

Local investigation found the Oct 13 service log line `mode=foundry accepted=True
attempts=1 latency_ms=7813 reasons=()`. The original adapter discarded provider
IDs/usage; neither that log nor the recording can reconstruct the original
transport response. The current Foundry resource diagnostic-settings lookup
returned no configured diagnostic records. No original trace was recovered.

`agents/inspections/corner-casual.en-GB.json` is a **new reproduction**, captured
2026-10-19T06:11:49Z. Three observed roles returned provider completion IDs,
`gpt-4.1-mini-2025-04-14`, usage and structured outputs. Python accepted the run
on its first narration attempt; its complete normalized response matches the old
recording. Go separately binds the request, each role output and final response
to the computed fact pack and publication gate before exposing it in Inspector.
This is one successful reference run, not a broader model-quality evaluation or
cryptographic provider attestation of the original file.

Observed usage: **1,524 input / 294 output tokens**. Microsoft's Retail Prices API
reported South Africa North Global Standard rates of USD 0.0004/1K input and
0.0016/1K output on Oct 19. Estimated token charge: **USD 0.00108**, not an Azure
invoice or a total hosting-cost measurement. No new cloud resources were created;
production remains recorded with a zero model-request cap.

Raw generated file SHA-256:
`62d42234cd3e38a1b4461b74ebfb73bf07f42ca5f765389dc6992e5e56d3044d`.
Git line-ending normalization can change raw-byte hashes; the Inspector compares
normalized content, not this working-file hash. Provider IDs and synthetic role
outputs are retained; credentials, headers and private account identifiers are not.

The opt-in `scripts/capture-agent-inspection.py --approve-paid` refuses an existing
capture/attempt marker, permits at most four model requests and limits each output
to 512 tokens. It is not invoked by the app, CI or any browser regression.

| Item | Evidence / limitation |
|---|---|
| Recording | `agents/recordings/corner-casual.en-GB.json` |
| Local file SHA-256 | `25b15cb32651f874fea036cce05ac646dd6e0bf66e16e5d2ac2c147fdae6b6e1` (raw working-file bytes; line-ending conversion changes this hash) |
| Audience | `en-GB`, `CASUAL` |
| Published sentence | The corner produced 1 shot. |
| Evidence | `evt-06`, `evt-07`; fact `fact-corner-a17ddcca8e6cba9b` |
| Content checks | Complete request matching, strict Python recording validation, independent Go publication gate; content verification is not provider attestation |
| Declared capture time | `2026-10-13T19:39:55.370Z` |
| Declared provider/deployment | Microsoft Foundry / `pulse-insights` |
| Declared model/version | `gpt-4.1-mini` / `2025-04-14` |
| Provider metadata source | These fields were hardcoded by `scripts/record-insight.mjs`, not extracted from a provider response |
| Original response/run identifier | **Pending from the person who ran the approved workflow** |

`Verified (recorded)` describes content checks on stored output, not fresh
generation or cryptographic proof of which model produced it. The documented
October 13 live workflow and the recording's self-declared metadata are not a
substitute for the original sanitized transport/run evidence.

## New open-play recording (Oct 19)

`agents/recordings/open-play-casual.en-GB.json` is a separate newly captured
English CASUAL output for the Go-computed Late siege rebound. The fact is one
completed pass before its phase's first shot, with ordered evidence `evt-25`,
`evt-26`, `evt-27`; no causal claim or goal is asserted. Its original provider
IDs, timestamps, model metadata, role outputs and usage are retained in
`agents/inspections/open-play-casual.en-GB.json` (`kind: captured-agent-run`).
Unlike the corner reference above, this is the original capture for its own
recording. It does not recover or alter the old corner provenance.

Python accepted the workflow on the first attempt in exactly three calls. Go
independently matched every source fact and accepted the recorded response and
its retained role outputs. Usage: **1,726 input / 326 output tokens**; estimated
token charge **USD 0.001212** using the Oct 19 rates above, not an invoice. No
new resources or runtime model-call allowance were configured. The explicit
manual capture script has a persistent attempt marker and a four-call/512-token
output cap. Tests and the app do not invoke it. One successful capture is not a
general model-accuracy claim or cryptographic provider attestation.

## Historical corner follow-up

The workflow operator should supply a sanitized provider response/trace with
UTC time, deployment/model metadata actually returned or observed, and a run
or response identifier. Bind it to this fact-pack request and returned sentence;
the three-stage workflow may need more than one response reference. Record
the evidence file/hash, reviewer and reviewed commit here. Redact credentials,
authorization headers, account identifiers and private data before publication.

Do not invent identifiers, rewrite the old metadata to look attested, overwrite
the recording or call a paid model just to fill this table. Until evidence is
available, describe it as **a checked recording whose provider metadata is
declared but not independently established**. Narrow public claims accordingly.
