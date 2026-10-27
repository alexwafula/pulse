# Submission readiness and human sign-offs

Updated 2026-10-27 for `main` (`aed03f9`, PR #49 merged). Team of four registered members: **Jefferson Gakuya**, **Alex Wafula**, **Ved Shah**, and **Dhruvi Parekh**.

| Deliverable | State / next action |
|---|---|
| Six synthetic scenarios (including `end-to-end` 11v11) | Implemented and merged on `main` (`aed03f9`); `checkdata` and browser suites pass |
| 3D/2D/SVG pitch, Broadcast/Tactical/Follow cameras & footwork | Implemented and merged (ADRs 0034, 0035); desktop and mobile browser checks pass |
| Read the game: Match briefing, Shot lens & Player Spotlight | Implemented and merged (ADR 0034); Go-calculated `/api/match-details` |
| Agent Inspector, Safety test & What changed? 10/20/30s comparison | Implemented and merged (ADR 0028); 3-role Foundry captures retained |
| Open-play pass-count insight, Shareable evidence links & Broadcast mode | Implemented and merged (ADR 0031, PR #44) |
| Pressure narration and both evidence types | Deterministic UI template; explicitly `Template / Not model-verified` |
| Static & HTML gzip and conditional caching | Implemented and unit-tested; verify `/version` on the deployed URL |
| Native-language review | Alex confirmed native-language/Swahili review was good on Oct 18; no corrections requested (`LOCALE-REVIEW.md`) |
| Python ingress & auth | Token authentication enforced (`401` on unauthenticated `/insights`); Go receives `python-recorded` (`INGRESS-REVIEW-2026-10-18.md`) |
| Windows Python & evaluation tests | 43 Python unit tests and 40/40 offline boundary evaluations pass (`0` false accepts) |
| Judge instructions and project description | Updated in `docs/PROJECT-PAGE.md`, `docs/JUDGE-INSTRUCTIONS.md`, and `SUBMISSION-PACK.md` |
| Demo video (`docs/media/demo-draft/pulse-demo.webm`) | Refreshed local capture under 2 minutes covering `end-to-end`, `late-siege` and `corner`; upload to YouTube/Vimeo and verify signed out |
| Prototype contributor permission | Ved Shah (registered team member) confirmed permission on 2026-10-19 (ADR 0015) |
| Registered team members | Jefferson Gakuya, Alex Wafula, Ved Shah, and Dhruvi Parekh |

## Prototype reuse confirmation

Reference: Matchlens HTML prototype. The reference hash supplied by Jefferson is
`f0c91dfb92d8e287c3942527c20c12de7ff6240fd199ce6615ccf1d7b9486428`
(551,931 bytes; original outside this repo).

Provenance record: [ADR 0015](decisions/0015-prototype-visual-system.md#fonts-and-provenance).

| Confirmation field | Value |
|---|---|
| Rights holder / contribution | Ved Shah, registered Pulse team member; Matchlens prototype made with claude.ai |
| Permission wording and date | The team may derive the Pulse UI from the prototype, code and markup included; 2026-10-19 |
| Third-party assets and attribution | Every entry in [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md), each with its licence text there. JavaScript and CSS (`:17-30`): three 0.186.1 (MIT); pixi.js 8.22.0 (MIT) with @pixi/colord 2.9.6 (MIT), earcut 3.2.4 (ISC), eventemitter3 5.0.4 (MIT), tiny-lru 11.4.7 (BSD-3-Clause), ismobilejs 1.1.1 (MIT) and parse-svg-path 0.2.0 (MIT); jquery 3.7.1 (MIT); select2 4.0.13 (MIT), which embeds almond 0.3.3 (MIT, `:32-34`); lucide 1.52.0 (ISC); htmx.org 2.0.11 (0BSD). Fonts (`:43-50`), all OFL-1.1: Outfit, Plus Jakarta Sans, Inter and Space Grotesk |
| Team representative confirmation | Recorded by Jefferson (commit `fec91b5`, 2026-10-19) and corroborated by Alex on 2026-10-19 |
| Approved public summary / evidence reference | Written confirmation held by the team outside the repo. This table and ADR 0015 are the public summary; Ved signed off on it (2026-10-19) |

## Final release checklist

1. Retain the language-review and contributor confirmations, review third-party
   assets/attribution and keep original-versus-reference recording claims distinct.
2. Confirm `/version` on the live Azure URL matches the latest `main` SHA and rerun the judge walkthrough in a clean browser.
3. Watch `docs/media/demo-draft/pulse-demo.webm` start to finish; verify duration under two minutes, readable captions, correct labels, fictional data, no credentials and no unsupported claims. Upload it to YouTube or Vimeo and test the URL while signed out.
4. Paste the updated copy from `SUBMISSION-PACK.md` / `docs/PROJECT-PAGE.md` into the hackathon portal, confirm all four team members (Jefferson Gakuya, Alex Wafula, Ved Shah, Dhruvi Parekh) are listed on the portal entry, and submit before **Wed Oct 28, 10:00 AM EAT** (Oct 27, 11:59 PM PT).
