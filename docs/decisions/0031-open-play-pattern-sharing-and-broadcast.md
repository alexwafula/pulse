# 0031: Open-play pattern, evidence links and broadcast presentation

Date: 2026-10-19
Status: Implemented on `feat/patterns-sharing-broadcast`; local preview, not deployed

## Scope

Alex requested feature priorities 3, 4 and 5, then asked to continue after the
proposed metric/shared-example handoff. Keep the existing v2 payload shape,
ownership boundaries, dependencies, cue gate, hosting configuration and zero
public model-call cap. Do not change CI or provision Azure resources.

## Open-play statistic

`open_play_passes_before_shot`: count completed PASS events in the 20 seconds
before a phase's first shot. Same team/phase throughout; failed actions, corners
and clearances disqualify that segment. The first qualifying pass starts the
window. Evidence preserves every action through the shot, including carries.
Count range is 1-32; later shots in that phase do not create duplicate packs.
No inference of causal attacking effectiveness, shot quality or goals.

Go computes and independently recomputes the complete fact pack before every
publication. Python's three-role workflow independently constrains count,
wording, ordered evidence and verification. Unknown facts/wording still reject
to the unchanged trusted-template policy. Shared positive/negative examples and
locale drafts are in `contracts/examples/open-play-pattern.json`; no schema or
Go/Python wire-model changes. Mixed feeds use per-cue Inspector provenance and
the `mixed` aggregate source header rather than mislabelling every cue recorded.

The current Late siege rebound has one pass, a carry and an unsuccessful shot:
`evt-25`, `evt-26`, `evt-27`. One approved Foundry capture accepted its English
CASUAL output in three requests. Provider IDs, all role outputs and tokens are
retained in `agents/inspections/open-play-casual.en-GB.json`. This is the actual
original capture for its new recording, not a reproduction of the old corner.
Usage: 1,726 input / 326 output tokens. Estimated token cost USD 0.001212 using
the Oct 19 rates in `RECORDING-PROVENANCE.md`, not an invoice or hosting total.
Capture is opt-in, capped at four calls/512 output tokens and protected by an
ignored persistent attempt marker. App requests and tests use recorded output
or templates; no live model path was enabled by this feature.

## Evidence links

The copy icon produces a canonical same-site link containing scenario, match,
exact integer match time, locale, persona, renderer, camera, control-field state
and optional event/cue/moment/comparison selection and return position. SHA-256
of the replay (24 hex characters) detects changed fixtures with reused IDs.
Recipients always start paused, never generating fresh AI. Explicit language and
persona win over saved preferences. Selected evidence opens Live. Generic links
retain the main section; sub-panel filter controls are not serialized.

Validate time bounds, identifiers, selection exclusivity and full replay identity;
then resolve cue/moment IDs after their actual feeds load. Invalid/stale links
show an error and remain paused at replay start, never quietly selecting another
action. Clipboard failure offers a selectable URL dialog. This is presentation
URL state, not a new shared football contract, authentication token or short-link
service. Links contain no credentials or provider keys.

## Broadcast

The presentation icon expands the existing pitch, renderer and transport to a
full-viewport layout, requesting browser fullscreen only on a user gesture.
Fullscreen denial still leaves a working presentation. Linked broadcast views
do not request fullscreen automatically. Escape/Exit restore normal layout,
focus and background interaction. No duplicate scene or playback timer.

Caption timing uses only match time: gated cues for up to 12 seconds after their
start, sustained-pressure templates for 10 seconds after detection (with the
uncalibrated-estimate label), shot source text for 6 seconds and an explicit
sequence-complete state. Rewind/expiry removes future/old captions. Labels retain
Recorded versus Template; a successful stored response is not fresh inference.
Enter at 1x for reading; exit restores the previous match speed. Existing clip
bounds, pause, return and renderer fallback remain authoritative.

## Checks

Go builder/gate/trace tests; shared Go/Python positive and negative examples;
original 30 offline agent cases plus 10 open-play cases; no paid test backend.
`evidence-link.test.mjs` covers round trips, precedence/bounds and stale identity.
`sharing-broadcast-browser.mjs` checks source/cue/tick/window restoration, reload,
clipboard fallback, actual recorded traces, expired/rewound captions and moving,
nonblank SVG/Three/Pixi scenes at desktop, 390px, 320px and mobile landscape.
Existing UI, replay, comparison, analytics, lower-third and render-loop suites
remain regression checks. New translations are drafts, not a fresh native review.
