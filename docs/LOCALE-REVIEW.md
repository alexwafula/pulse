# Native language review

Status: **PENDING HUMAN REVIEW**. Automated parity/evidence tests do not certify
linguistic accuracy. No native-speaker approval has been recorded.

Review sources:

- `app/web/static/locales.json`: interface and source-event/recap sentences.
- `contracts/examples/locale-template-cases.json`: exact supported insight texts.
- `agents/src/pulse_agents/locales/templates.py` and `app/internal/ai/locales.go`:
  matching Python/Go templates.

| Locale | Interface | Template insight | Reviewer/date |
|---|---|---|---|
| English (`en-GB`) | Teammate review pending | Existing bounded wording; technical tests pass | Pending |
| Kiswahili (`sw-KE`) | Translation draft | Translation draft | Native reviewer needed |
| Hindi (`hi-IN`) | Translation draft | Translation draft | Native reviewer needed |

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

Non-English requests remain deterministic templates with no model calls.
Native sign-off alone does not authorize model publication; that needs its own
evaluation and publication-policy review. Do not mark this checklist complete
based on an automated translator or an assistant's self-review.
