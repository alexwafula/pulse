# Submission readiness and human sign-offs

Updated 2026-10-18. Readiness implementation: `fix/demo-readiness`, based on main
`7a1e154`. Local changes are not a claim of deployment or submission.

| Deliverable | State / next action |
|---|---|
| Shot-map/canvas, Live moment navigation | Implemented; desktop/mobile regression passes |
| Pressure narration and both evidence types | Deterministic UI template; not model-verified; no contract change |
| Static gzip and conditional caching | Implemented and unit-tested; verify headers again after deployment |
| HTML page/panel gzip | Implemented and unit-tested; verify `Content-Encoding` on the deployed URL after release |
| Native-language review | Alex confirmed native-language/Swahili review was good on Oct 18; no corrections requested. Reviewer/scope details are recorded honestly in `LOCALE-REVIEW.md` |
| Python ingress | Current hosting retained by Alex's decision; token auth works, network isolation unresolved/deferred (`INGRESS-REVIEW-2026-10-18.md`) |
| Windows Python tests | Path comparison normalized without changing the model-cap checks; all 34 tests pass locally |
| Judge instructions and project description | Updated; clean-browser check against final deployed SHA still required |
| Video | Alex accepted the existing 87.40-second draft on Oct 19; final public upload pending. Refresh after feature freeze if the new features are included |
| Recording provenance | Original capture trace unavailable; a new approved three-call reference run with retained provider IDs reproduces it exactly. See audit; never describe it as recovered original evidence |
| Prototype contributor permission | Alex confirmed on Oct 19 that Ved is a teammate and the team has permission to reuse the prototype. This records the representative's confirmation, not an independent rights audit |
| Project licence | Team decision pending; do not choose a licence for someone else's work |

## Prototype reuse confirmation

Reference: Matchlens HTML prototype. The reference hash supplied by Jefferson is
`f0c91dfb92d8e287c3942527c20c12de7ff6240fd199ce6615ccf1d7b9486428`
(551,931 bytes; original outside this repo). This identifies the supplied
reference, not permission or authorship evidence.

Ask the actual rights holder to confirm in writing: contributor name, original
work and creation date, which files/assets they own, authority to contribute,
permission for modification, public GitHub distribution and hackathon/demo
publication, required attribution, and any third-party restrictions. Confirm
team membership/rights with the representative. Keep private correspondence
private; commit only a contributor-approved summary and reference/date.

| Confirmation field | Value |
|---|---|
| Rights holder / contribution | Ved / supplied UI prototype, reported by Alex |
| Permission wording and date | Alex, Oct 19: Ved is in the team and permission to use the prototype is confirmed |
| Third-party assets and attribution | Pending; also review `THIRD-PARTY-NOTICES.md` |
| Team representative confirmation | Alex confirmed team membership and reuse permission in the project conversation on Oct 19 |
| Approved public summary / evidence reference | This dated summary of Alex's confirmation; no private correspondence copied |

Do not tick this from verbal assumptions, an AI-generated statement or a repo
invite. If permission cannot be confirmed, remove/replace the affected work
before submission. No legal compliance certification is made here.

## Final release checklist

1. Retain the language-review and contributor confirmations, review third-party
   assets/attribution and keep original-versus-reference recording claims distinct.
2. Review/merge the tested branch. Let main's existing CI/image workflow deploy.
   Check `/version` matches that main SHA and rerun the judge instructions.
3. Watch the complete video; verify duration, readable captions, correct labels,
   fictional data, no credentials and no unsupported claims. Upload it to an
   accepted public video platform and test the URL while signed out.
4. Confirm public repo, project fields, representative and final links. Keep
   hosting funded/available through the end of judging; recorded mode stays on.

Requirements were rechecked against the [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md)
on Oct 18: sections 4.3-4.4 require working, accurately represented functionality,
a video under two minutes and a public repo/video link; 4.6-4.8 cover rights
and judge access; 4.9 requires English submission materials or translations.
The representative must read the full rules rather than treat this checklist
as an eligibility determination.
