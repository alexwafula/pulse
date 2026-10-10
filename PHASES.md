# PHASES.md

Delivery plan for Pulse, for a **team of two**. Read `AGENTS.md` first for rules and the repo map. Dates are Africa/Nairobi (EAT). Tick boxes as work completes, and record changes of plan at the bottom.

## How this plan works

1. **Walking skeleton first.** One scenario works end to end, ugly but complete, by Fri Oct 9. Everything after improves a working system.
2. **The contract is the seam.** The pipeline engineer and the agents engineer meet only at `contracts/`. Change it deliberately.
3. **Fake each other.** The engine ships recorded fact packs. The agent service ships a template-only mode. Nobody waits.
4. **Evals before prompts.** The agents engineer builds the evaluation set first, then tunes prompts against it.
5. **Cut lines are pre-agreed.** When behind at a checkpoint, cut in the order given below. Do not negotiate under pressure.

| Role | Owns |
|---|---|
| **Pipeline (P)** | `app/`, `data/`, `infra/azure/`, web shell, overlay island, metrics, moments, MCP tools, cue gate, delivery |
| **Agents (A)** | `agents/`, prompts, locales, `tests/evaluations/`, Speech, Foundry wiring and tracing |
| **Shared (S)** | `contracts/`, `tests/integration/`, `docs/`, CI |

## Key dates (EAT)

| Date | Event |
|---|---|
| Tue Oct 6, 7:00 PM | Submission period opens (9:00 AM PT) |
| Tue Oct 20, 10:00 PM | Registration closes (12:00 PM PT). Be registered long before. |
| Thu Oct 22 | Our feature freeze |
| Sun Oct 25 | Our target to submit |
| Wed Oct 28, about 10:00 AM | Submissions close (Oct 27, 11:59 PM PT) |
| Tue Nov 10 | Judging ends. Demo must stay live and free until then. |
| By Fri Nov 20 | Winners announced |

## Scope for two people

| Tier | Items |
|---|---|
| **Must** | Golden path deployed on Azure with a public URL. Control vs Chaos index with three moment types. Explainer, Narrator, Verifier with template fallback. Evidence Trail. Casual and Analyst personas. Player Spotlight. English and Swahili text. Judge mode (seeded replay). Tests, CI, README. Demo video. |
| **Should** | Event Hubs ingest. Speech voice with word-synced captions. Recap agent (half time and full time). Newcomer and Loyalist personas. Foundry traces shown in the demo. **Play Fingerprint** ("Seen before", gated, see Phase 3). **Pulse Daily**: downloadable two-voice recap MP3, only after Speech and Recap work. |
| **Won't** | Web PubSub, Foundry hosted agents, Producer Rundown, live Match Radio, heads-up mode, Cosmos DB (use cookies or local JSON for profiles), broadcast hardware adapters, auto-eventing from video. |

**Cut order if behind** (first item goes first): Pulse Daily MP3 -> Newcomer and Loyalist -> Recap agent -> **Play Fingerprint** -> Event Hubs (keep the in-process adapter) -> Speech audio (keep text captions) -> Player Spotlight -> Swahili (keep English).

> Play Fingerprint's position is a proposal from `Pulse-Play-Fingerprint.docx`. Confirm it together, then delete this note.
**Never cut:** the golden path, the Verifier with fallback, the Evidence Trail, deployment, tests.

---

## Phase 0: Align and freeze (Mon Oct 5 to Tue Oct 6)

Goal: both engineers can work independently for three days without colliding.

**Both**
- [ ] Confirm the agent set: Explainer, Narrator, Verifier. Analyst and Producer are deterministic code in the engine, not LLM agents.
- [ ] Tag **contract v2** after teammate review. Implemented golden-path events: PASS, SHOT, CARRY, CROSS, CLEARANCE, CORNER. Cue: COMMENTARY. The broader event/cue list needs new schemas and examples before implementation.
- [x] Define the **agent messages** in `contracts/schemas/`: `FactPack` in, `NarrationDraft` out, `VerificationResult` out. Go/Python models and shared positive/negative examples added.
- [ ] Plan an optional similar-plays block in `FactPack` (Play Fingerprint, Phase 3) so adding it later is additive. The incoming proposal calls it `similar_plays`; agree its v2 camelCase name and schema before implementation.
- [x] Choose the engine to agent boundary: direct HTTP first, recorded in `docs/decisions/0004-agent-contract-alignment.md`. The v2 request envelope and local template endpoint are implemented; real models remain later work.
- [x] Fill in the Commands section of `AGENTS.md` with what really runs.
- [ ] Agree the Play Fingerprint gate and cut-order position (see Phase 3 and `Pulse-Play-Fingerprint.docx`).
- [ ] Register for the hackathon, appoint the Representative, and create the project entry when the portal opens on Oct 6.

**P**
- [ ] Azure subscription, budget alert, and region chosen. Request Azure OpenAI quota now. (Bicep templates authored and validated in CI in PR #2; subscription Contributor access remains unresolved).
- [ ] Decide the order of work for the walking skeleton (see Phase 1).

**A**
- [ ] List the cases the evaluation set must cover (supported claim, invented claim, wrong number, over-long text, persona, locale).

**Exit:** contract v2 tagged, agent messages defined, boundary decision recorded, both registered.

---

## Phase 1: Walking skeleton (Tue Oct 6 to Fri Oct 9)

Goal: one command shows a verified cue on screen, with either side stubbed.

**P**
- [ ] Replayer reads `data/samples/first-sequence.json` and streams events in order (1x and 10x).
- [x] Offline replay detects **one** corner-to-first-shot moment with source event IDs. Live engine state remains later work.
- [x] Go builds the fact pack and exposes it through the HTTP boundary.
- [x] Deterministic template builds a cue. The conservative **cue gate** recomputes evidence and accepts canonical templates only.
- [ ] SSE delivery with heartbeats. `app/web/src/pitch.ts` shows the cue over a placeholder video or pitch.
- [ ] Deploy the skeleton to Azure Container Apps (even ugly) and run a 15-minute SSE soak test. Azure is the biggest unknown, so do it now. (Bicep templates validated in CI step 10 in PR #2; Container Apps provisioning blocked pending Azure Contributor subscription access).

**A**
- [x] Python HTTP skeleton with three deterministic, agent-shaped stages returning contract-valid templates. No model-backed agents yet.
- [x] Offline evaluation harness reads `contracts/examples/` and runs all three stages with a fake backend. Twelve recorded cases check the canonical guard, not model quality.
- [x] Async shadow orchestration with file prompts, bounded calls, one narration retry and template fallback. Not wired to live model calls or viewer output.
- [ ] First real model call through Foundry with tracing visible.
- [x] Draft the first 30 recorded evaluation cases. Passing these fake-backend checks is not a live Verifier quality result.

**Integration day: Fri Oct 9.** Wire real agent service to the engine. If it is not ready, ship with the template-only mode and keep going.

**Exit:** a seeded sequence replays, a cue passes the gate and appears in the browser on the Azure URL. `tests/integration/` has one passing test for it.

---

## Phase 2: Real intelligence (Fri Oct 9 to Tue Oct 13)

Goal: the system is smart, not just connected.

**P**
- [x] **Scenario generator & kinematics (ADR 0009)**: Deterministic 11v11 generator (`app/internal/sim/`, `app/cmd/gen/`), shared squads (`data/squads/squads.json`), universal `to`-semantics rule across all 6 event kinds, and `late-siege` fixture (401 frames at 200 ms, 22 players, 5 Hz) (merged in PR #8, commit `a5c48e9`). Scenario-parameter routing fix (`83fb33d`) returns 404 for unknown scenarios and tests fact-pack isolation.
- [x] **Data-quality checks (`checkdata`)**: Pitch bounds, 200 ms spacing, speed/acceleration caps, actor proximity, receiver arrival, min separation, and contract validity (merged in PR #8, commit `684ad95`). Per-script `expect.minShots` (waived for `calm-midfield`) and wired into `scripts/check.sh` step 4/10 over every scenario in `data/scenarios/` (merged in PR #16, commits `37d1260`, `c8ba306`), expanding `check.sh` to 10 steps.
- [x] **Metrics v1 core on coarse grid every 500 ms (ADR 0010, docs/metrics.md)**: Time-to-reach pitch control (`model: "time-to-reach-control-v1"`, `label: "model estimate, uncalibrated"`), normalised tactical entropy, and pressing intensity implemented in pure package `app/internal/metrics` (merged in PR #16, commit `4e5c54e`; spec in PR #15, commit `a452c08`). PDR deferred to v2.1 per ADR 0010 §11.
- [x] **Control vs Chaos index**: Evaluated from control share, inverse entropy, and pressing intensity with a 2 s inclusive hold (`pressHeldFromMs`) over a 3-tick median (merged in PR #16, commit `4e5c54e`).
- [x] **Three moment types & two 11v11 scenarios**: `SET_PIECE_SHOT`, `SUSTAINED_PRESSURE`, and `CONTROL_SWING` with hysteresis implemented in `app/internal/moments` (merged in PR #16, commit `df2b340`). Scripted scenarios: `late-siege` (PR #8) and `calm-midfield` (PR #16, commit `b4338cf`). Red-card and pressing-trap deferred to v2.1 per ADR 0009 §5 and ADR 0010 §11. `CONTROL_SWING.reasons` strictly `[]` (tick evidence) with nearby events moved to `contextEventIds` ("not evidence", PR #16 commit `f7163f3`).
- [x] **Replay-based tests and golden file**: Tests T1-T14 against compiling stubs (commit `a141dd2`), T8b off-grid mirror toy (commit `a5d137c`), and amd64 golden file `app/testdata/metrics/late-siege.golden.json` (161225 bytes) (merged in PR #16, commit `2c7bcac`).
- [ ] **HTTP Metrics & Moments API (G2 Stage 2)**: `GET /api/metrics?scenario=<id>[&grid=1]` and `GET /api/moments?scenario=<id>`, compute-once cache (`sync.Once`), gzip compression, ETag / 304, T15, calm-midfield routing, `trackingMetrics: "supported"|"unsupported"` + `reason`. Status: **in review (PR #18 on `feat/g2-metrics-api`, not merged)**.
- [ ] MCP tool server exposing facts and calculations to agents.

### Key decisions resolved (G2 Metrics & Moments, ADR 0010)
- **D1 (Mirror & Coincident)**: Split mirror-symmetric test T1 and coincident test T2; both pass bit-exact.
- **D2 (Calm-midfield baseline)**: Pre-declared outcome of zero moments of any type; verified in T11.
- **D3 (Tracking support contract)**: HTTP 200 with `trackingMetrics: "supported"|"unsupported"` + `reason` (not a plain boolean); unsupported replays still return event-only `SET_PIECE_SHOT` moments.
- **D4 (Contrast rule)**: Replaced cross-team comparison with within-team contrast T9a (mean `finalThird_vale` siege [5290000, 5325000] minus pre-siege [5280000, 5289500] ≥ 0.10, measured 0.2239) and T9b (`SUSTAINED_PRESSURE` fires for vale, never for bastion). Cross-team comparison rejected because final-third geometry differs per team.
- **D5 (Final-third actions)**: Counts `COMPLETE` PASS, CARRY, CROSS, CORNER; shots excluded.
- **CONTROL_SWING threshold**: Updated pre-run from 0.15 to 0.30 (re-arm 0.10) evaluating on `index_T - index_opp` (cancels shared structure).
- **Press hold**: 2 s inclusive (`pressHeldFromMs`), chosen over 3-tick median to cover ~30 m passes / ~40 m crosses without delaying swings.
- **Model identity**: `model: "time-to-reach-control-v1"` and `label: "model estimate, uncalibrated"` on every response; model ID must be bumped for any metric calculation change.

**A**
- [ ] Explainer, Narrator and Verifier on real models with structured output.
- [ ] Retry once, then template fallback, with logged rejection reasons.
- [ ] Evaluation set of at least 30 cases. Verifier false-accept rate is zero on invented-claim cases.
- [ ] Prompts as files in `prompts/`. Cache by input hash.
- [ ] Persona support for CASUAL and ANALYST.

**Integration day: Tue Oct 13.** Real agents on real moments across all three scenarios.

**Exit:** three scenarios run end to end with real agents. The Verifier visibly rejects a bad draft and recovers. Evals are reported and trace screenshots exist.

**Play Fingerprint gate inputs, checked at the Tue Oct 13 stand-up:** (1) three scenarios run end to end with real agents, (2) Verifier false-accept rate is zero on the current evals, (3) Evidence Trail is started. All three true means go. Anything else means park it, no discussion.

---

## Phase 3: Experience and Azure (Tue Oct 13 to Sun Oct 18)

Goal: the demo path is complete and deployed.

**P**
- [x] **UI sports-analytics reskin (Stage 0 & 1)**: Dark sports-analytics design tokens (`tokens.css`), typography (OFL Syne, Outfit, JetBrains Mono), glass panels, computed share bar (merged in PR #6, commit `7b7b0fc`).
- [x] **UI Stage 1 review fixes**: Accessible contrast tokens raising `--text-muted` to `#758a7e` (4.97:1 contrast on `#0f1613`, passes WCAG AA 4.5:1), `/design` route gated behind `PULSE_DEV=1` with unit tests, responsive scrubber, card ordering, and horizontal KPI strip (merged in PR #8, commit `601bf45`).
- [ ] **UI Control Field pass**: Overlay pitch control surface, contours, and moment markers (`feat/ui-control-field`, open item) [Owner: P].
- [ ] htmx shell: persona picker, language switch, analyst panels, stat cards.
- [ ] Overlay island: lower thirds, moment banner, player tags, captions region.
- [ ] **Evidence Trail**: click an insight to replay the events behind it on a mini pitch.
- [ ] Player Spotlight view.
- [ ] CI/CD to Container Apps. Judge mode: seeded replay on demand with cached model and speech output.
- [ ] Event Hubs adapter behind the ingest interface (Should).

**A**
- [ ] Swahili locale with glossary and native-speaker review.
- [ ] SPOTLIGHT persona. NEWCOMER and LOYALIST if time allows.
- [ ] Speech audio with word timings stored in Blob and referenced from the cue (Should).
- [ ] Recap agent for half time and full time (Should).
- [ ] Pulse Daily (Should, after Speech and Recap work): 3 to 4 minute two-voice recap as a downloadable MP3, chapters linking to each moment's Evidence Trail. No new agent. First to cut.

### Play Fingerprint (Should, gated, Tue Oct 13 to Sat Oct 17)

Full design in `Pulse-Play-Fingerprint.docx`. Deterministic Go retrieval over earlier plays, so history claims become lookups the Verifier can check. Scope wording is a hard rule: always "in our match library", never "in football" or "this season".

| ID | Task | Owner | Est. |
|---|---|---|---|
| FP1 | Generator: recurring pattern templates and variety knobs for about 30 seeded filler matches. Do this first. If it overruns half a day, hand-author the recurring plays for the three scenarios only. | P | 0.5 d |
| FP2 | Tokeniser, attack-direction normalisation, pairing, 32-bit address | P | 0.5 d |
| FP3 | Index build and lookup with coherence voting, deterministic ordering | P | 0.5 d |
| FP4 | Golden, dropped-event, jitter and tempo, false-positive tests; config sweep | P | 0.5 d |
| FP5 | `SimilarPlay` schema, shared fixtures (1 valid, 3 invalid), Go and Python models | S | 0.25 d |
| FP6 | Fact pack fields and MCP tool `find_similar_plays` | P | 0.5 d |
| FP7 | Prompts, four Verifier checks (`HISTORY_UNSUPPORTED`, `HISTORY_COUNT_MISMATCH`, `HISTORY_SCOPE`, `HISTORY_MATCH_UNKNOWN`), 10 new eval cases | A | 1 d |
| FP8 | Viewer: "Seen before" chip and side-by-side mini pitch (list fallback) | P | 1 d |
| FP9 | README wording, judge instructions, 20-second demo beat | A | 0.25 d |

- [ ] Gate passed on Tue Oct 13.
- [ ] FP4 pass bars met by Sat Oct 17 evening (self-match 100%, dropped events and jitter at least 90%, zero false positives on 200 or more unrelated plays). If not green, cut the feature and keep the work on a branch.
- [ ] Stop at once if the Evidence Trail is not finished by Thu Oct 15.

**Integration day: Thu Oct 15 and Sun Oct 18.**

**Exit:** the full demo path runs on the public URL in judge mode, including Evidence Trail, two personas, Spotlight and Swahili. If Play Fingerprint is in, "Seen before" works on the Azure URL in judge mode.

---

## Phase 4: Harden and freeze (Sun Oct 18 to Thu Oct 22)

- [ ] Confirm registration is complete (the deadline is Tue Oct 20, 10:00 PM EAT).
- [ ] Evaluation thresholds met. Verifier false-accept stays at zero.
- [ ] Cost controls: model choice, caching, per-match caps, budget alerts verified.
- [ ] Accessibility pass: semantic HTML, aria-live captions, contrast, keyboard use.
- [ ] README, architecture notes, decision records, data-quality report, judge instructions.
- [ ] Public repo audit: no secrets, no real names or marks, licence present. Search the repo, UI strings, video script and README for third-party names (for example "Shazam") and remove them. Use "Play Fingerprint" and "Seen before".
- [ ] README and UI footer state that the match library is synthetic with seeded recurring patterns.
- [ ] Re-run the 15-minute SSE soak test and a cold-start test on the deployed app.
- [ ] **Feature freeze Thu Oct 22.** Only fixes after this.

**Exit:** a stable public URL, green CI, and a clean repo.

---

## Phase 5: Demo and submit (Thu Oct 22 to Sun Oct 25)

- [ ] Script the video from the demo path. Under **2 minutes**, public URL, no third-party trademarks or copyrighted music, English or subtitled.
- [ ] Record, edit, upload to YouTube or Vimeo, and check it plays logged out.
- [ ] Write the pitch: what we built, the Microsoft and Azure technologies used, what it does, the problem it solves.
- [ ] Final run of the demo from a clean browser using only the submitted instructions.
- [ ] **Submit by Sun Oct 25.** Buffer Oct 26 to 27. The real deadline is Wed Oct 28, about 10:00 AM EAT.
- [ ] Keep the deployment up and within budget until Nov 10.

---

## Checkpoints and rhythm

| When | What |
|---|---|
| Daily, 15 minutes | What shipped, what is blocked, what changes in the contract |
| Fri Oct 9 | Skeleton works end to end |
| Tue Oct 13 | Real agents on real moments. Play Fingerprint go/no-go. |
| Sat Oct 17 | Play Fingerprint hard stop: tests green or cut |
| Sun Oct 18 | Demo path complete and deployed |
| Thu Oct 22 | Freeze |
| Sun Oct 25 | Submitted |

**Load balance:** the pipeline side is the heavier one. From Oct 13, A takes on Speech, evaluation reporting, the README and the demo script so P can concentrate on the engine and the overlay.

## Risks to watch

| Risk | Early signal | Response |
|---|---|---|
| Pipeline overload | Metrics or overlay slipping at the Oct 13 checkpoint | Apply the cut order. Move Speech and docs to A. |
| Contract drift between languages | Example tests failing in one language | Fix examples first, then both models, same change |
| Agent hallucination reaching viewers | Gate or Verifier bypassed | Treat as a release blocker |
| Azure surprises (timeouts, quota, cost) | Skeleton deploy fails or soak test drops | Fall back to SSE only, smaller models, cached output |
| Swahili quality | Reviewer rejects terms | Keep English term in glossary, cut Swahili per cut order |
| Play Fingerprint crowds out Phase 3 | Evidence Trail not done by Thu Oct 15 | Stop it. Cut order position is fourth. |
| History claims overreach or the data looks real | Narrator says "in football" or "this season"; judges ask if data is real | Verifier `HISTORY_SCOPE` check; say "synthetic library" in README, video and UI |
| Demo does not match video | Features appear in video that are unstable | Cut the feature from the video, not the test |
| Formation geometry dominates absolute shares | Issue #17: generator ignores `lineHeightM`/`compactness`; vale share > 0.70 even in calm-midfield | Never display shares as headline numbers; use only as within-team delta over time, labeled uncalibrated. Tracked in issue #17. |
| Fragile swing threshold margins | Late-siege CONTROL_SWING signals (0.3026, 0.3148) are within 0.0026-0.0148 of 0.30 threshold | Do not assert exact swing count in regression tests; treat 2 swings as property of specific fixture and parameters. |
| Mid-range pressing intensity unverified on real fixtures | 25 of 68 late-siege non-null ticks fall in [0.2, 0.8) without ground-truth validation; calm-midfield max 0.0081 | Hand-checked toys (T5, T6, T6b) verify formulas; treat real-fixture continuous values as uncalibrated model estimates. |
| Cross-architecture golden file parity | Go math library bit-equality on arm64 is unverified (golden file generated on amd64 only) | Run golden check on arm64 before relying on it cross-platform; mirror test T8b provides local invariant. |
| Two-fixture tuning limit | Metrics thresholds tuned exclusively against synthetic `late-siege` and `calm-midfield` | Acknowledge separation of two authored stories only; do not claim calibration for general football. |

## Open items and owners (as of Oct 11)

| Item | Owner | Branch / Ref | Status |
|---|---|---|---|
| Stage 2 API (HTTP endpoints, cache, gzip, ETag, T15) | P | `feat/g2-metrics-api` | In review ([PR #18](https://github.com/alexwafula/pulse/pull/18)) |
| UI Control Field pass (pitch control surface overlay) | P | `feat/ui-control-field` | Pending Stage 2 API merge |
| Contract v2.1 & C1 "tick evidence kind" | S / A | `contracts/` | Awaiting agents engineer collaboration for FactPack schema alignment |
| Azure deployment & SSE soak test | P | `infra/azure/` | Blocked: Contributor subscription access unresolved (Bicep builds cleanly) |
| Agents A2 work (Foundry models, structured output, prompt tuning) | A | `agents/` | Pending live model wiring and evaluation run against Foundry |
| Play Fingerprint gate on Oct 13 | S | Stand-up checkpoint | Decision pending Oct 13 based on 3 gate criteria; do not pre-decide |
| Hackathon registration and Representative | S | Portal | Must complete well before Oct 20 10:00 PM EAT deadline |
| Swahili reviewer | A | `agents/src/pulse_agents/locales/` | Native speaker review of football glossary required before demo |

## Issues opened so far

| Issue | Title | Status | Notes |
|---|---|---|---|
| #1 | `[Infra] Author Azure Container Apps Bicep templates and unify CI check workflow` | Closed | Merged in PR #2 (`ea9c031`) |
| #3 | `[UI] UI Polish, Renderer Optimization, Accessible Passing Network & Demo Flow` | Closed | Merged in PR #4 (`e05d7e1`) |
| #5 | `feat(ui): premium dark sports-analytics reskin with explainability signature` | Closed | Merged in PR #6 (`7b7b0fc`) |
| #7 | `feat(sim): deterministic 11v11 scenario generator and data-quality validation` | Closed | Merged in PR #8 (`a5c48e9`) |
| #9 | `feat(web): score display placeholder "–:–" when live score tracking is absent` | Open | UI placeholder when match state has no score |
| #10 | `spec(metrics): continuous pressing intensity metric vs discrete PRESSURE event definition` | Open | Non-circularity rule documented in ADR 0009 §4.3 and ADR 0010 |
| #11 | `perf(server): enable HTTP gzip/brotli compression middleware on Go API server` | Open | Handled for metrics/moments in PR #18; general server compression open |
| #12 | `sim(generator): calibrate tactical ratio and realism of carries vs passing sequences` | Open | Simulation tuning for future scenario authoring |
| #13 | `test(quality): explicit assertion for 1 ms event timeMs resolution vs 200 ms tracking grid` | Open | Data-quality check on timestamp precision |
| #14 | `data(squads): reconcile squad numbers and rosters with legacy scenario fixtures` | Open | Align player IDs and jersey numbers across 4v4 and 11v11 fixtures |
| #17 | `sim: generator accepts but ignores lineHeightM and compactness` | Open | Generator ignores tactical line height; marked reserved in PR #18 |

## Change log

| Date | Change | By |
|---|---|---|
| Oct 5 | Initial plan for a two-person team | |
| Oct 6 | Added Play Fingerprint (gated Should, tasks FP1 to FP9, Oct 13 gate, Oct 17 hard stop), Pulse Daily (Should, MP3 only), new cut-order positions, trademark and synthetic-data audit items, two risks | |
| Oct 6 | Contract v2 aligns field names, enums, locales and coordinates; preserve the corner demo, start with COMMENTARY and direct HTTP; message models/tests ready, runtime agents pending. | Alex + Codex |
| Oct 6 | Alex requested a local Three.js/PixiJS/SVG comparison before pushing. Replay clock and contracts unchanged; this experience spike does not complete the agent or SSE phases. | Alex + Codex |
| Oct 8 | Local corner fact builder, Python template HTTP pipeline, conservative Go gate and browser evidence replay connected. SSE, Azure and real model calls remain pending. | Alex + Codex |
| Oct 8 | Added three authored local scenario variants, attacking-route metrics, Casual/Analyst control, deterministic recap, opt-in mock-tested Foundry shadow adapter, container definitions, setup instructions and registration media. Goals need contract approval; Kiswahili needs review; live models, streaming and deployment remain pending. | Alex + Codex |
| Oct 11 | Updated delivery plan to reflect current repo state: PR #8 (11v11 scenario generator, shared squads, checkdata, late-siege fixture, routing fix, to-semantics), PR #15 (G2 Stage 0 docs), and PR #16 (G2 Stage 1 metrics/moments core, calm-midfield, T1-T14+T8b, amd64 golden file, checkdata in check.sh) merged; G2 Stage 2 API in review (PR #18); recorded decisions D1-D5, swing 0.30, 2s press hold, trackingMetrics flag, model ID bumping; documented 5 metrics risks, 8 open items with owners, and issues #1-#17. Dates and scopes unchanged. | Alex + Codex |

