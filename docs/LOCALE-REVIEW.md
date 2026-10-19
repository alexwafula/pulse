# Native language review

Oct 19 feature follow-up: Inspector/comparison labels and technical explanations
have new Swahili/Hindi drafts with matching interpolation keys. Alex's acceptance
below applies to the previously reviewed copy, not these newly added strings.

Status: **TEAM ACCEPTANCE RECORDED**. On October 18 Alex confirmed that the
native-language/Swahili review was good, reported no issues and requested no
translation corrections. This records the user's acceptance, not an assistant's
linguistic certification. Individual native reviewers and a separate Hindi
review scope were not named; do not invent those details.

Oct 18 local readiness branch: all 252 interface keys exist in each translated
locale, with matching English placeholder sets (literal English keys fall back
to themselves). The recently added English placeholders now
have translation drafts. `Entropy` in Kiswahili and `Control vs Chaos` remain
English glossary terms. This is a technical audit, not native approval.

Review sources:

- `app/web/static/locales.json`: interface and source-event/recap sentences.
- `contracts/examples/locale-template-cases.json`: exact supported insight texts.
- `agents/src/pulse_agents/locales/templates.py` and `app/internal/ai/locales.go`:
  matching Python/Go templates.

| Locale | Interface | Template insight | Reviewer/date |
|---|---|---|---|
| English (`en-GB`) | No corrections requested | Existing bounded wording; technical tests pass | Alex's team acceptance, 2026-10-18 |
| Kiswahili (`sw-KE`) | Accepted per reported review | Accepted per reported review | Alex confirmed review, 2026-10-18; individual reviewer not named |
| Hindi (`hi-IN`) | No corrections requested | No corrections requested; model publication stays off | Separate reviewer/scope not specified in the confirmation |

## Review procedure

1. Open Corner chance. Pause at the end and switch Casual/Analyst in each locale.
2. Confirm the insight still says one shot after a corner, never a goal. Casual
   and Analyst may differ in style but must carry the same number and evidence.
3. Review Scenarios search/filter labels, Live, Story, maps, Recap and Fact check.
   Use 320px mobile and desktop; check wrapping and Devanagari rendering.
4. Check technical distinctions: verified recording versus template, shot versus
   goal, unavailable versus zero, and tracking occupancy versus possession.
5. Preserve fictional names, IDs, source windows and numbers. Keep glossary terms
   in English when a reviewed local equivalent is unavailable.
6. Record corrections and a real reviewer/date in the table. Update both Go and
   Python template texts plus shared examples together; run locale tests.

## Reviewer handoff

Open `/?scenario=late-siege&locale=sw-KE` (or `hi-IN`). Pause, seek to the end,
open Control, then replay Sustained pressure. Compare Casual and Analyst. The
count, time window, fictional team name, event IDs and tracking timestamps must
not change. Check that "Not model-verified" cannot be mistaken for verification.
Then review the Corner chance insight in both personas; it reports a shot,
never a goal. Review the glossary below before approving the complete catalog.

| Concept | Meaning that must survive translation |
|---|---|
| Verified (recorded) | A stored response, checked again; not fresh model generation |
| Template / Not model-verified | Deterministic wording; no model-verification claim |
| model estimate, uncalibrated | Experimental tracking calculation, not measured possession |
| Final-third actions | Completed passes/carries/crosses/corners in the detector window; not shots |
| Tracking occupancy | Player-time in a grid cell, not touches or pressure |
| Score unavailable | No recorded result; must not become 0:0 or a goal |
| Metric ticks | Sample timestamps supporting a model calculation, not event IDs |

Record approval as: reviewer name, native locale, date, reviewed commit, screens
and template sources reviewed, corrections and remaining exceptions. Do not add
private contact details. If only part is reviewed, state that scope explicitly.

Non-English requests remain deterministic templates with no model calls.
Native sign-off alone does not authorize model publication; that needs its own
evaluation and publication-policy review. Do not mark this checklist complete
based on an automated translator or an assistant's self-review.
