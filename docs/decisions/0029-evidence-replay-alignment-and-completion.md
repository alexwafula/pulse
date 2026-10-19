# 0029: Evidence replay alignment and completion

Date: 2026-10-19
Status: Accepted by Alex for merge; deployment tracked by the main release workflow

## Context

Some evidence controls sought the clock while leaving the pitch hidden in a
different screen. Playback discarded visible frame time above 250 ms, and some
seek/restart paths reused an old frame timestamp. A corner clip stopped at the
shot event's start before the recorded ball movement finished. Generated clips
also contain a long tracking-only tail after their last source action.

## Decision

- Route source-event inspections through one validated controller path. Open Live,
  pause at the exact event timestamp, highlight its event/actor and prepare a
  bounded 1x action replay. Press Play to run that action; Return to match restores
  the saved clock. Unknown event IDs do not move the clock.
- Keep manual scrub seeks paused and reset frame timing on seeks, play/pause,
  replay/restart, speed changes and tab visibility changes. Advance by the actual
  visible elapsed time, not a 250 ms cap. Hidden tabs remain suspended.
- Interpolate the same recorded tracking at that clock in every renderer. Binary
  search finds the bracketing samples. Draw a freshly remounted visible pitch
  without waiting for IntersectionObserver's next notification.
- Separate visual playback bounds from fact/evidence bounds. Event timestamps
  mark action starts. Use the last recorded ball movement before the next source
  event, with at most 300 ms settling time, to end an action clip. Do not force a
  blocked shot to its nominal destination. Never include the next event.
- Allow corner cue/SET_PIECE_SHOT playback to finish its last cited action's
  recorded movement. Show the visual extension explicitly; do not mutate cue,
  fact, event or detector timestamps. Pressure/tick moment and comparison clips
  keep their exact original boundaries (including earlier-window end minus 1 ms).
- Show distinct selected-action, evidence-complete, tracking-tail and
  sequence-complete states below the pitch. The tracking-tail notice appears
  after the final action finishes, not before unseen actions. It offers an
  explicit recap seek rather than silently skipping match time. At the end,
  offer Replay sequence, View recap and Scenarios.

## Constraints

No fixture regeneration, invented goals, post-sequence movement, extra AI calls,
shared-contract changes or cue-gate changes. Sparse authored tracking remains
sparse: this fixes navigation/clock/clip alignment, not the underlying fidelity
of those recordings. Score stays unavailable. Recap still uses match end.

## Verification

- `playback.test.mjs`: exact/off-grid frame bracketing, action limits, shot
  postroll without mutating evidence, tracking-only tails, elapsed-time clock
  advancement and translation placeholders.
- `replay-browser.mjs`: all five scenarios, exact source positions/times,
  delegated evidence controls, slow visible frames, rendered shot movement,
  replay/return, end actions and desktop/mobile SVG/Three.js/PixiJS screenshots.
- Existing comparison, analytics, experience, lower-third and render-loop checks
  guard exclusive window bounds, unchanged facts, mounted renderer ownership,
  overlays and paused/hidden rendering.

New UI translations use the existing locale catalogs; they are not a new human
language-review sign-off.
