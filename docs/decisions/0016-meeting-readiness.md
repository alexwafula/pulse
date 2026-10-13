# Meeting readiness: verified publishing and contributor boundaries

Date: 2026-10-13
Status: implementation on `feat/meeting-readiness`; team review pending.

## Decision

Keep the existing v2 wire schemas. Enable an explicit Python `foundry` mode
alongside the default `template` and diagnostic `foundry-shadow` modes. All
three roles use the existing Foundry adapter. The only publishable fact remains
the deterministically calculated corner-to-first-shot count, not tactical intent.

Explainer must return the canonical fact claim. Narrator chooses one of three
approved strings per English persona and copies identity and complete evidence.
Verifier must check the claim with all evidence. Python and Go independently
validate the words, identity, audience and full ordered evidence; Go additionally
recalculates the pack from the replay. A model approval alone is insufficient.
Published verifier reasons use a code-owned, fact-only statement, not free model
prose that could smuggle an unsupported claim into the returned cue metadata.
Unsupported drafts retry once; errors, deadlines, cost caps and a second rejection
return the unchanged canonical `FALLBACK_TEMPLATE`. Fallback cannot claim verification.

Go's HTTP budget is 20 seconds. Python's workflow deadline is 12 seconds; an
already-started Foundry HTTP request can finish within its additional four-second
transport timeout during async thread shutdown. Successful/rejected responses
are cached, one workflow runs at a time, and the per-process request cap remains.
Cancelled Go requests may leave a bounded Python workflow completing/cacheable;
there is no distributed cancellation or Azure-wide spending cap.

These are application-policy changes, not schema extensions. Free prose, additional
metric facts, player agents and Kiswahili require separate agreement and tests.
Offline tests use recorded backends. Live model quality and Azure are not verified.

Cloud follow-up on 2026-10-13: the student subscription's allowed-region policy
and model capacity were checked; Foundry resource/project/model were deployed in
South Africa North, and one approved live CASUAL corner workflow returned VERIFIED
through both gates. Desktop/mobile browser checks passed using its cached response.
Only one workflow was logged. Resource-group budget alerts are configured, not a
hard spending cap. App hosting, broader live evaluations and traces remain pending.

## Identity and graphics

Canonical player identity comes from `data/squads/fictional-league.json`; squad
numbers are not ID suffixes. The authored sample remains a partial-roster clip.
Its identities/references are reconciled by team and squad number without moving
tracking positions or changing action clocks. Contract examples are independent
contract fixtures, not the fictional-league roster. Go tests and the read-only
roster audit prevent demo drift.

Heatmap cells and passing nodes support tap/click and a native selector with live
detail output. Node evidence is computed in Go from elapsed completed passes.
Occupancy must never acquire event evidence: it represents tracking player-time.
Selection uses stable keys across refreshes and disappears if rewinding removes it.
SVG rendering and native inspection remain available without Canvas 2D.

## Pressing versus PRESSURE (issue #10 proposal)

`pressing` is an uncalibrated, continuous tracking-derived reach estimate in [0,1].
It is not a pressure-event count, a binary closing-speed threshold, or a fact that
agents may narrate under the current publishing policy. Null means no supported
carrier, not zero pressing. No discrete `PRESSURE` event exists in v2.

If a provider event is added later, it must carry its own event evidence. It must
not be used to calculate tracking pressing or substitute for metric-tick evidence.
A tracking moment cites its ticks; source actions are context unless a separately
computed event fact supports them. This boundary is documented and tested, but
the shared-contract decision still needs both owners' review before issue closure.

## Shared setup

`scripts/start-local.ps1` launches Go and Python, chooses unused localhost ports,
checks health and the template HTTP boundary, and reports exact URLs/PIDs/logs.
Template mode is explicit even if inherited Foundry variables exist. Foundry
startup does not make an insight request or spend credits by itself. Reviewers
must still verify their own clean clone; Docker and the shared Azure preview
remain separate checks and are not claimed complete.
