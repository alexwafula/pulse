# Agent Inspector and clock-bound comparison

Date: 2026-10-19. Branch: `feat/agent-inspector-comparison`.

Integrated main `5dfdae5` before handoff, retaining D3b's lower third, status
badges, 44px transport targets, motion and the team's fuller permission record.
The D3b browser fixtures now target the inspection envelope; their assertions
and the unchanged `/api/insights` endpoint remain intact.

Alex approved these two features, the existing prototype theme, and one small
paid reference workflow. No production configuration or shared v2 contract changes.

## Inspector

`GET /api/agent-inspection` wraps the unchanged cue feed with presentation data:
computed fact pack, actual delivered response, delivery outcome, measured Go
delivery/check time, the independent gate result and an isolated bad-claim test.
It shares the exact publication handler with `/api/insights`. The browser requests
one envelope per audience change, not a second model workflow when it opens the
Inspector. Rejecting Python output still produces the checked Go template.

The historical Explainer trace was not retained. A stored verification decision
is not proof of a fresh agent execution or provider identity. No hidden reasoning
or invented stage durations are shown. Inspector visibility follows the same
clock/expiry and audience as the displayed cue.

One approved reference run made three GPT-4.1-mini calls, first attempt accepted,
1,524 input / 294 output tokens. It exactly reproduced the old response. Sanitized
provider IDs, model metadata, role outputs, token usage and observed durations
are in `agents/inspections/corner-casual.en-GB.json`. It is explicitly a new
reproduction, not the original capture. Go only attaches it after matching the
full request/response, checking each stage output and independently gating it.
No Foundry tracing/App Insights service is claimed or provisioned.

The manual capture script caps requests at four and output at 512 tokens per
call. Its persistent ignored marker prevents accidental reruns. There are no
live calls in CI or browser tests. Public recorded mode and all model-cap defaults
remain unchanged. See `RECORDING-PROVENANCE.md` for cost and provenance limits.

## What changed?

Insights adds same-team, adjacent 10/20/30-second windows ending at the replay
clock. Both must fit completely; partial windows stay unavailable. Earlier is
`[start, boundary)`, recent is `[boundary, cutoff]`: no double-counted event and
no future action. These are elapsed-clock windows; inclusive endpoint assignment
is explicit, not a claim of equal event sample sizes.

Go counts completed passes, shots and existing box-entry/lane memberships.
Metric definitions are reused, not recalculated differently in TypeScript.
Two pitch diagrams plot the actual source action coordinates. Direction-relative
lanes use the existing metric series. Source buttons inspect individual events;
Replay window uses the existing pitch, clock, pause/return and renderer lifecycle.
Moment comparison is a separate icon; the existing moment action still replays
in Live. No causal explanation, new agent fact, xG or calibrated metric is claimed.

HTMX supplies the clock-bound comparison fragment. Controls use the existing
Select2 lifecycle, semantic colours and fonts. New Swahili/Hindi feature copy is
draft translation and is not covered by Alex's earlier review of existing copy.

## Checks

Go tests cover boundary assignment, invalid windows, rewind/no-future output,
wrong-team filtering, remote forgery/fallback, reference matching and tampered
role outputs. Python tests cover opt-in metadata capture and output budgets.
`node tests/integration/inspection-comparison-browser.mjs` checks both features,
no extra delivery on Inspector opening, reference/safety labels, source counts,
Select2, moment navigation and 1440/390/320px layouts. Existing homepage, locales,
experience and demo-readiness suites remain regression gates.
