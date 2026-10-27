> Oct 23 local review exception: Alex approved a separate-branch scenario/UI
> improvement pass: briefings, one two-sided replay, shot geometry, contextual
> stats and presentation-only Player Spotlight. Alex reviewed the local camera
> and pass-stat follow-up on Oct 26 and requested merging PR #49 to main; Azure
> release verification remains pending CI and `/version`. This does not complete
> any parked agent, Speech, streaming or Play Fingerprint milestone.

# PHASES.md

Delivery plan for Pulse, for a ~~**team of two**~~ **team of four registered members: Jefferson, Alex, Ved and Dhruvi Parekh** (updated Oct 27). Ved made the Matchlens prototype that is the design basis for the UI (ADR 0015). Read `AGENTS.md` first for rules and the repo map. Dates are Africa/Nairobi (EAT). Tick boxes as work completes, and record changes of plan at the bottom.

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

## Status key

Oct 19 priorities 3-5 follow-up: PR #44 (merged to main) implements
the open-play pass-count workflow, shareable evidence links and broadcast mode.
ADR 0031 defines precise count/evidence rules and replay URL/presentation limits.
One approved three-call capture retained the actual new pattern's original
provider outputs; public model calls remain disabled. Main releases deploy it in
recorded mode with a zero model-request cap; recheck the released SHA afterwards.

Oct 19 feature follow-up: Alex approved Agent Inspector and What Changed?, kept
the existing theme, confirmed Ved's team membership/reuse permission and accepted
the draft video. Branch `feat/agent-inspector-comparison` adds actual delivery/gate
inspection, a clearly labelled injected test, a new three-call Foundry reference
run with retained role evidence, and equal clock-bound source-event comparisons.
No v2, production-mode or default model-cap change. The old original trace remains
unavailable; the new reproduction is separate. ADR 0028 records scope and tests.
Alex approved merging these additions and the replay-alignment follow-up (ADR
0029) on Oct 19. Deployment is verified separately through the main release
workflow and `/version`; local checks are not proof of an Azure release.
Older dated audits below remain historical snapshots, not the current submission
checklist.

Statuses below were checked on **Sat Oct 17** against `4aa3813` and re-checked on **Sun Oct 18** against `main` at `08eafa9` (#32, after #30). That commit is the one live on Azure: `GET /version` returned `"sha":"08eafa9c…","ref":"main"` on Oct 18.

| Status | Meaning |
|---|---|
| **DONE** | Evidence cited (file:line, test, PR or command output) |
| **PARTIAL** | Some of it exists; what is missing is stated |
| **NOT STARTED** | No code or doc for it was found on `main` |
| **DROPPED/PARKED** | Stopped by a dated decision (see Decisions) |
| **UNVERIFIED** | Cannot be checked from the repo; the reason is stated |

Local checks run for this update, all on `08eafa9`: `gofmt -l .` (no output), `go vet ./...` and `go test ./...` (all packages `ok`), `python3 -m unittest discover -s agents/tests` (`Ran 34 tests … OK`), `python3 tests/evaluations/run_agents.py` (`30/30; false accepts: 0`), `npm run check:web` and `npm run build:web` (exit 0, bundles unchanged in git), and `node tests/integration/locale-browser.mjs` against a local Go server (`6 passed, 0 failed`; no Python service, so the en-GB insight came from the Go template). Bicep was not run locally; the CI run for `08eafa9` passed, and that run includes it.

## Dates

- **Feature freeze:** Thu Oct 22.
- **Target submission:** Sun Oct 25.
- **Hard deadline:** Wed Oct 28, about 10:00 AM EAT.
- **Demo must stay live and free until:** Tue Nov 10.

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

Play Fingerprint was parked on Oct 13 (see Decisions), so it is no longer in play for cutting.
**Never cut:** the golden path, the Verifier with fallback, the Evidence Trail, deployment, tests.

### Must tier on Oct 17

| Must item | Status | Evidence |
|---|---|---|
| Golden path on Azure, public URL | DONE | Live `/version` reports `08eafa9`; the `Build Azure Images` run for `08eafa9` passed, including `Verify deployed homepage, replay and authenticated insights` (`.github/workflows/build-images.yml:134`) |
| Control vs Chaos index, three moment types | DONE | `app/internal/metrics/compute.go:242` (`indexOf`); `app/internal/moments/moments.go:16-18` (`SET_PIECE_SHOT`, `SUSTAINED_PRESSURE`, `CONTROL_SWING`) |
| Explainer, Narrator, Verifier with template fallback | PARTIAL | Workflow and fallback in `agents/src/pulse_agents/workflow.py:34-86`. Live model output is limited to the corner-shot fact and 6 approved sentences (`app/internal/ai/publication.go:13-25`) |
| Evidence Trail | DONE | `tests/integration/analytics-browser.mjs:106-119` (tick versus source-event evidence) |
| Casual and Analyst | DONE | `contracts/schemas/insight-request.schema.json:11` |
| Player Spotlight | PARTIAL | Player focus filter only (`app/web/templates/pages/match.html:352`; ADR 0014:26-30 says it is not a SPOTLIGHT persona) |
| English and Swahili text | PARTIAL | `sw-KE` templates exist; `docs/LOCALE-REVIEW.md:3` reads "PENDING HUMAN REVIEW" |
| Judge mode (seeded replay) | PARTIAL | Recorded mode serves the reviewed corner output with no model calls (ADR 0017). No speech output |
| Tests, CI, README | DONE | `scripts/check.sh` (10 steps); CI passed on `08eafa9`; `README.md` |
| Demo video | NOT STARTED | Phase 5 |

---

## Decisions

| Date | Decision | Evidence |
|---|---|---|
| Oct 10-11 | Metrics v1 decisions recorded in ADR 0010 (folded in from PR #19): D1 mirror and coincident toys tested separately; D2 calm-midfield declares zero moments in advance; D3 `trackingMetrics: "supported"/"unsupported"` with `reason`; D4 final-third contrast within one team only, never across teams; D5 final-third actions count completed PASS, CARRY, CROSS, CORNER and exclude shots. `CONTROL_SWING` uses an index-difference threshold of 0.30 with re-arm 0.10. Press hold is 2 s inclusive. Every response carries `model: "time-to-reach-control-v1"` and `label: "model estimate, uncalibrated"`; the model ID must change when a calculation changes. | `docs/decisions/0010-metrics-and-moments.md`; `app/internal/metrics/params.go:8-10`, `:88`, `:92` |
| Oct 13 | **Play Fingerprint: NO-GO, parked.** There was no real-model path at the gate (gate input 1 failed). FP1 to FP9 are not started. | No `similarPlays` field in `contracts/`, `app/` or `agents/` (`git grep`) |
| Oct 14 | **The match experience at `/` (alias `/experience`) is the UI.** Three.js is the default renderer, with PixiJS and SVG as fallbacks. `/legacy` keeps the old dashboard (#24); its nav link is hidden since #32. It is built from the Matchlens prototype (ADRs 0012, 0013, 0014, 0015, 0022; `docs/PROTOTYPE-REVIEW-2026-10-15.md`). ~~The contributor's permission is still to be confirmed.~~ Ved (registered team member, author of the prototype) confirmed permission on Oct 19, code and markup included (ADR 0015). **Matchlens reference file:** 551,931 bytes, SHA-256 `f0c91dfb92d8e287c3942527c20c12de7ff6240fd199ce6615ccf1d7b9486428`, kept outside the repo. | Hash and size as supplied by Jefferson on Oct 18; the file is not in the repo, so it was not re-hashed for this update. Routes: `app/internal/transport/http/handler.go:187-204`. Default: `app/web/src/pitch.ts:826-827`. SVG fallback: `pitch.ts:218` |
| Oct 16 | **Supported locales are `en-GB`, `sw-KE` and `hi-IN`. VERIFIED narration is `en-GB` only.** #25 added the check to both validators. | `contracts/schemas/insight-request.schema.json:10`; `app/internal/ai/publication.go:31`; `agents/src/pulse_agents/publication.py:24` |
| Oct 16 | **`main` is not branch-protected, by choice.** Every merge to `main` deploys automatically after CI (checks -> build -> deploy). `/version`, `X-Pulse-Build` and the footer build label came in #26. The `ref` build-arg and the post-deploy `/version` smoke check came in #28. Rollback is `git revert -m 1 <merge-sha>` through a PR. | `gh api repos/alexwafula/pulse/branches/main` returns `protected: false`; `.github/workflows/build-images.yml:21`, `:92`, `:143`; `docs/RELEASE.md:69-80`; the live response carries `x-pulse-build: 08eafa9` |
| Oct 16 | **The cue gate is intact after #25.** The 6 approved corner sentences are hash-identical, and the gate requires exact evidence equality. Evals are 30/30 with 0 false accepts. | Re-checked Oct 17 (at `4aa3813`) and Oct 18 (at `08eafa9`): the SHA-256 of `ApprovedWordings` (Go) and `approved_wordings` (Python) is identical to `ce435e2^1`. `reflect.DeepEqual` on the draft and evidence is at `app/internal/ai/publication.go:52-61`. `run_agents.py` printed `30/30; false accepts: 0` |
| Oct 17 | **Third-party notices and font licence files added** (#29). | `THIRD-PARTY-NOTICES.md`; `README.md:304-308` |
| Standing | **The live demo stays in recorded agent mode through judging.** | `README.md:13`, `:57`; ADR 0017 |

---

## Freeze plan (to Thu Oct 22)

PR numbers checked with `gh pr list` on Oct 18. The only open PR is #31 (this document). Rows marked DONE were re-verified on `main` at `08eafa9`.

| ID | Item | Status | PR |
|---|---|---|---|
| I | Shot-map test and canvas stability | LOCAL DONE: resize-safe canvas lifecycle, context recovery/SVG fallback and source shot-pixel checks at desktop/mobile sizes | `fix/demo-readiness`, not deployed |
| F | Model request cap default 0, plus the parameters file | DONE: `server.py:20` `model_request_cap()` (unset or invalid → 0), `service.py:18` `max_requests: int = 0`, `main.parameters.json:18` `0`, `compose.yaml:11` `:-0`; `test_model_cap.py` 5/5 pass, including `test_no_infra_or_compose_file_sets_a_nonzero_model_request_cap` | #30 (merged Oct 17) |
| A1 | Locale allowlist | DONE: one `LOCALES` list (`app/web/src/i18n.ts:4`); server `requestLocale()` falls back to `en-GB` (`app/internal/transport/http/locales.go:15-20`); `TestUnknownLocaleFallsBackToEnglish` pass; locale-browser "locale allowlist" and "storage and URL precedence (17 cases)" pass | #32 (merged Oct 18) |
| A2 | i18n routing of 30 visible strings | DONE: locale-browser "hi-IN visible text routed through i18n (27 reviewed strings)" passes. Of the 30, 27 are asserted by name, 2 labels were removed under A5, and the pitch stamp was already routed. The 43 new keys still hold English text in sw-KE and hi-IN (see G) | #32 (merged Oct 18) |
| A3 | Index-difference headline | DONE: `#metric-index-delta` shows the API `indexDelta`, `N/A` when it is missing (`match.html:399`); `TestMetricsTeamOrderDefinesIndexDelta` passes; locale-browser measured late-siege `-0.5537` and calm-midfield `-0.4287`, and corner `N/A` | #32 (merged Oct 18) |
| A4 | Evidence Trail label | DONE: `#moment-values-label` sits before `#moment-values` (`match.html:519`); locale-browser "canonical model label in Control, Evidence trail and banner" passes | #32 (merged Oct 18) |
| A5 | Canonical label | DONE: one `model estimate, uncalibrated` key; `Experimental` and `Formation-sensitive` appear 0 times in `match.html`, `pitch.js` and `experience.js`; `TestModelLabelIsCanonicalInServedHTMLAndBundles` and `TestModelLabelHasOneCatalogKey` pass | #32 (merged Oct 18) |
| A6 | Hide the Legacy link | DONE: the link carries `hidden` (`match.html:30`) and `/legacy` still serves; `TestPageCopy` passes; live `/` on Oct 18 served the link with `hidden` | #32 (merged Oct 18) |
| B | Clicking a moment stays in Live | LOCAL DONE: explicit Live navigation, mounted pitch retained, persona changes preserve detector clips | `fix/demo-readiness`, not deployed |
| E | `SUSTAINED_PRESSURE` deterministic template narration (template only, never VERIFIED) | LOCAL DONE: Go-backed count/estimate, source actions and ticks, validation/expiry tests; no v2 cue or gate change | `fix/demo-readiness`, not deployed |
| G | `sw-KE` and `hi-IN` translation review, including the #32 keys and pressure text | TEAM ACCEPTANCE RECORDED: Alex confirmed native-language/Swahili review with no issues; individual reviewers and separate Hindi scope were not named. Technical checks cover all 252 translated keys/placeholders (`docs/LOCALE-REVIEW.md`) | Follow-up on `fix/agent-ingress-isolation` |
| H | gzip and `Cache-Control` for static assets | LOCAL DONE: gzip, representation-specific ETags, GET/HEAD/304/ranges and must-revalidate. Production headers must be rechecked after release | `fix/demo-readiness`, not deployed |

### Oct 18 local readiness verification

Main fast-forwarded from `70790a8` to `7a1e154`; changes isolated on
`fix/demo-readiness`. Go tests/vet, TypeScript checks/build, five focused
pressure/catalog tests, six locale-browser sections, full experience-browser,
analytics-browser and new readiness desktop/mobile checks pass. Agent fake-backend
evaluation remains 30/30 with zero false accepts, not live-model quality.
Windows Python baseline is 33 pass / 1 failure: the model-cap inventory test
compares backslash paths to slash keys; agent-owner approval is needed for the
one-line `.as_posix()` test fix. Cap behavior remains zero-default and unchanged.

Oct 18 follow-up: Alex authorized that test fix; the inventory now uses
`path.relative_to(ROOT).as_posix()`. All 34 Python tests pass on Windows, with
unchanged assertions and runtime cap policy. Alex also confirmed the
native-language/Swahili review was good with no corrections requested; individual
reviewer/scope details are in `docs/LOCALE-REVIEW.md`.

Ingress was retested through stable API `2026-07-01`: internal ingress is stored,
but public Python health still returns 200; unauthenticated insights return 401
and Go receives `python-recorded`. Alex explicitly chose to keep hosting and
defer migration. This is authenticated access, not verified private networking.
See `docs/INGRESS-REVIEW-2026-10-18.md`. No new resources, model calls or CI changes.

Judge instructions, project-page copy, provenance audit and submission sign-offs
are in `docs/`. An actual captioned local demo draft was captured (87.40 seconds);
Public upload, final human watch-through and permissions remain open; language
acceptance is recorded above. The demo stays recorded; no new paid model calls
or resources were introduced by the readiness work.
See ADR 0023 and `docs/SUBMISSION-READINESS.md`.

---

## Known gaps

- ~~**Matchlens permission is unconfirmed.** This blocks submission.~~ Resolved Oct 19: Ved confirmed permission in writing, held by the team outside the repo (ADR 0015; `docs/SUBMISSION-READINESS.md`).
- **Recording provenance.** The model and provider for the `corner-casual.en-GB` recording are typed by hand in `scripts/record-insight.mjs:34` and are not proven by the recording itself.
- **Project-page status corrected locally.** The readiness branch distinguishes the one bounded live corner workflow from the public recorded/template demo. Original provider provenance is still pending (`docs/RECORDING-PROVENANCE.md`).
- **Late-siege cannot be VERIFIED.** The approved sentences cover the corner-shot fact only (`app/internal/ai/publication.go:12-25`).
- **215 aria and tooltip strings are outside i18n.** The count comes from the Oct 16 locale scan at `ce435e2` and was not re-measured. #32 left these strings unchanged and lists them in `docs/I18N-BACKLOG.md`. One visible string is also still English: the raw `reason` from `/api/metrics`.
- **No LICENSE file: team decision pending, check hackathon rules.** There is no project `LICENSE` at the repo root (checked Oct 18).
- **Remaining P2/P3 items from the Oct 16 frontend audit.** The audit is not committed to the repo, so its items are not listed here (UNVERIFIED).
- **Contract v2.1 items, none implemented** (folded in from PR #19; `git grep` finds none in `contracts/`): a `TICK` evidence kind with `tickTimesMs`, `POSSESSION_CHANGE`, `PRESSURE`, a player `role`, one `to` rule with optional `intendedTarget`, and `frameIntervalMs`. The event enum is still the six v2.0 kinds (`contracts/schemas/event.schema.json:16`). These need approval from both engineers.

---

## Phase 0: Align and freeze (Mon Oct 5 to Tue Oct 6)

Goal: both engineers can work independently for three days without colliding.

**Both**
- [x] **DONE.** Confirm the agent set: Explainer, Narrator, Verifier. Analyst and Producer are deterministic code in the engine, not LLM agents. *Evidence:* `AGENTS.md` §4 step 6 and §7; `agents/src/pulse_agents/prompts/{explainer,narrator,verifier}.txt`.
- [ ] **PARTIAL.** Tag **contract v2** after teammate review. Implemented golden-path events: PASS, SHOT, CARRY, CROSS, CLEARANCE, CORNER. Cue: COMMENTARY. The broader event/cue list needs new schemas and examples before implementation. *Evidence:* schemas pin `"2.0.0"` (`contracts/schemas/match.schema.json:9`), and the six events and COMMENTARY are in use (`event.schema.json:16`, `overlay-cue.schema.json:19`). *Missing:* no git tag (`git tag` prints nothing).
- [x] **DONE.** Define the **agent messages** in `contracts/schemas/`: `FactPack` in, `NarrationDraft` out, `VerificationResult` out. Go/Python models and shared positive/negative examples added. *Evidence:* `contracts/schemas/{fact-pack,narration-draft,verification-result}.schema.json`, `contracts/examples/invalid-*.json`; `go test ./app/internal/domain` ok.
- [ ] **DROPPED/PARKED** (Oct 13, Play Fingerprint NO-GO). Plan an optional similar-plays block in `FactPack`.
- [x] **DONE.** Choose the engine to agent boundary: direct HTTP first. *Evidence:* `docs/decisions/0004-agent-contract-alignment.md`; `/api/insights` at `app/internal/transport/http/handler.go:111`.
- [x] **DONE.** Fill in the Commands section of `AGENTS.md` with what really runs. *Evidence:* `AGENTS.md` §8.
- [x] **DONE.** Agree the Play Fingerprint gate and cut-order position. *Evidence:* the gate was applied on Oct 13 with a NO-GO result (Decisions).
- [x] **DONE: confirmed by Jefferson 17 Oct; portal not visible from repo.** Register for the hackathon, appoint the Representative, and create the project entry.

**P**
- [x] **DONE.** Azure subscription, budget alert, and region chosen. Azure OpenAI quota requested. *Evidence:* region South Africa North (live hostname `*.southafricanorth.azurecontainerapps.io`). The `gpt-4.1-mini` deployment is provisioned (`AGENTS.md` §4). Budget `pulse-credit-alerts` was deployed at 20 per month (`docs/FOUNDRY-AZURE-SETUP.md:40-46`); its currency unit is unconfirmed.
- [x] **DONE.** Decide the order of work for the walking skeleton. *Evidence:* `docs/decisions/0001-first-replay.md`, `0002-demo-scope.md`.

**A**
- [x] **DONE.** List the cases the evaluation set must cover (supported claim, invented claim, wrong number, over-long text, persona, locale). *Evidence:* `tests/evaluations/agent-cases.json`, 30 cases, including `supported casual`, `invented fact`, `wrong count`, `overlong narration`, `wrong requested persona` and `unrelated locale`.

**Exit:** contract v2 tagged, agent messages defined, boundary decision recorded, both registered. **PARTIAL:** no v2 tag. Registration confirmed by Jefferson on Oct 17.

---

## Phase 1: Walking skeleton (Tue Oct 6 to Fri Oct 9)

Goal: one command shows a verified cue on screen, with either side stubbed.

**P**
- [x] **DONE.** Replayer reads `data/samples/first-sequence.json` and streams events in order (1x and 10x). *Evidence:* `simulator.Run(ctx, replay, speed, emit)` at `app/internal/simulator/replay.go:97`, used by `app/cmd/simulate/main.go:28`; `app/internal/simulator/replay_test.go:15`; UI speeds 1×/4×/10× at `app/web/templates/pages/match.html:305-307`.
- [x] **DONE.** Offline replay detects **one** corner-to-first-shot moment with source event IDs. *Evidence:* `go test ./app/internal/facts` ok.
- [x] **DONE.** Go builds the fact pack and exposes it through the HTTP boundary. *Evidence:* `/api/fact-packs` at `handler.go:101`.
- [x] **DONE.** Deterministic template builds a cue. The conservative **cue gate** recomputes evidence and accepts canonical templates only. *Evidence:* `app/internal/ai/publication.go:27-61`; `go test ./app/internal/ai` ok.
- [ ] **PARTIAL.** SSE delivery with heartbeats. `app/web/src/pitch.ts` shows the cue over a placeholder video or pitch. *Done:* the cue is drawn over the pitch on the replay clock. *Missing:* SSE. No `text/event-stream`, `EventSource` or heartbeat exists in `app/` or `agents/` (`grep`), and `AGENTS.md` §4 says "SSE remains unimplemented".
- [ ] **PARTIAL.** Deploy the skeleton to Azure Container Apps and run a 15-minute SSE soak test. *Done:* deployed; the Oct 15 PR #25 handoff records a 904.27-second HTTP/template soak on `ce435e2`, 112 requests with zero failures. *Missing:* SSE implementation and SSE soak, not all reliability evidence. Historical scope/source is now in `docs/CLOUD-READINESS-2026-10-15.md`; this is not a new soak of the readiness branch.

**A**
- [x] **DONE.** Python HTTP skeleton with three deterministic, agent-shaped stages returning contract-valid templates. *Evidence:* `agents/src/pulse_agents/server.py`, `pipeline.py`; 34 Python tests pass.
- [x] **DONE.** Offline evaluation harness reads `contracts/examples/` and runs all three stages with a fake backend. *Evidence:* `tests/evaluations/run_agents.py` (30 agent cases plus 14 publication cases); output `30/30; false accepts: 0`. This is not a measure of model quality.
- [x] **DONE.** Async orchestration with file prompts, bounded calls, one narration retry and template fallback. *Evidence:* `agents/src/pulse_agents/workflow.py:34-86`; `test_workflow.test_retry_once_then_recover`.
- [ ] **PARTIAL.** First real model call through Foundry with tracing visible. *Done:* one bounded live CASUAL corner workflow passed both the Python and Go checks (`AGENTS.md` §4; ADR 0017). *Missing:* tracing. No Application Insights resource is connected (`docs/CLOUD-READINESS-2026-10-15.md`, "Approval-gated work").
- [x] **DONE.** Draft the first 30 recorded evaluation cases. *Evidence:* `tests/evaluations/agent-cases.json` (30). These are fake-backend checks, not a live Verifier quality result.

**Integration day: Fri Oct 9.** Wire real agent service to the engine. If it is not ready, ship with the template-only mode and keep going.

**Exit:** a seeded sequence replays, a cue passes the gate and appears in the browser on the Azure URL. `tests/integration/` has one passing test for it. **DONE:** each release runs `tests/integration/container-smoke.mjs` against the deployed URL (`build-images.yml:134-139`), and it passed for `08eafa9`.

---

## Phase 2: Real intelligence (Fri Oct 9 to Tue Oct 13)

Goal: the system is smart, not just connected.

**P**
- [ ] **PARTIAL.** Metrics v1 on a coarse grid every 500 ms: pitch control, pressing intensity, pass difficulty rating, normalised tactical entropy. *Done:* pitch control, pressing and entropy on a 21×14 grid every 500 ms (`app/internal/metrics/params.go:82-83`; PRs #15, #16). *Missing:* pass difficulty rating, deferred by ADR 0010 §11. All values are labelled "model estimate, uncalibrated".
- [x] **DONE.** Control vs Chaos index, validated against the scripted scenarios. *Evidence:* `compute.go:242`; `TestT9a_LateSiegeWithinTeamContrast`, `TestT9b_LateSiegeSustainedPressure`, `TestT11_CalmMidfieldNoMoments` (`app/internal/metrics/scenario_test.go`). It has been checked on two synthetic fixtures only.
- [ ] **PARTIAL.** Three moment types tied to three scenarios in `data/scenarios/`. *Done:* three types (`moments.go:16-18`). *Missing:* only two generated scenarios exist (`late-siege` and `calm-midfield`; the latter is designed to have zero moments). Pressing trap is deferred to v2.1 (ADR 0009 §5.2); red-card swing is deferred (ADR 0009 §5.3).
- [ ] **NOT STARTED.** MCP tool server exposing facts and calculations to agents. *Evidence:* no MCP code in `app/` or `agents/` (`grep -ril mcp`).
- [ ] **PARTIAL.** Data-quality checks on generated matches (pass accuracy, shots, possession ranges). *Done:* `checkdata` covers bounds, spacing, speed and acceleration, proximity and contract validity, plus `expect.minShots` (`app/internal/sim/quality.go:108`), and runs as step 4 of `scripts/check.sh` (PRs #8, #16). *Missing:* pass-accuracy and possession-range checks.
- [x] **DONE.** Go tests: replay-based golden tests for metrics and moments. *Evidence:* `TestT13_Golden`, `TestT14_Determinism`; `app/testdata/metrics/late-siege.golden.json` (161225 bytes). The metrics and moments API (`TestT15_MetricsAndMomentsAPI`) was merged in #18.

**A**
- [ ] **PARTIAL.** Explainer, Narrator and Verifier on real models with structured output. *Done:* Foundry REST adapter (`agents/src/pulse_agents/foundry.py`) and one live CASUAL corner workflow. *Missing:* live use is bounded to the corner-shot fact and 6 approved sentences, and no other moment can publish VERIFIED text.
- [x] **DONE.** Retry once, then template fallback, with logged rejection reasons. *Evidence:* `workflow.py:60-86`; `service.py:73-75` logs `reasons=`; `test_publication.test_retry_recovers_without_publishing_bad_draft`.
- [x] **DONE.** Evaluation set of at least 30 cases. Verifier false-accept rate is zero on invented-claim cases. *Evidence:* `30/30; false accepts: 0` (offline fake backend, not live model accuracy).
- [x] **DONE.** Prompts as files in `prompts/`. Cache by input hash. *Evidence:* `agents/src/pulse_agents/prompts/*.txt`; SHA-256 key at `service.py:43`; `test_foundry.test_service_cache_and_cost_cap`.
- [x] **DONE.** Persona support for CASUAL and ANALYST. *Evidence:* `insight-request.schema.json:11`; `agents/src/pulse_agents/contracts.py:43`.

**Integration day: Tue Oct 13.** Real agents on real moments across all three scenarios.

**Exit:** three scenarios run end to end with real agents. The Verifier visibly rejects a bad draft and recovers. Evals are reported and trace screenshots exist. **PARTIAL:** real agents run on the corner fact only. Rejection and recovery are shown in tests (`test_retry_once_then_recover`), not in the UI. No traces.

**Play Fingerprint gate inputs, checked at the Tue Oct 13 stand-up:** (1) three scenarios run end to end with real agents, (2) Verifier false-accept rate is zero on the current evals, (3) Evidence Trail is started. **Result: NO-GO.** Input 1 was not met (Decisions, Oct 13).

---

## Phase 3: Experience and Azure (Tue Oct 13 to Sun Oct 18)

Goal: the demo path is complete and deployed.

**P**
- [x] **DONE.** htmx shell: persona picker, language switch, analyst panels, stat cards. *Evidence:* `/experience/panel` (`handler.go:86`); `tests/integration/controls-browser.mjs` (all locales and personas, persistence, 320/390/768/1440 px); ADR 0021.
- [ ] **PARTIAL.** Overlay island: lower thirds, moment banner, player tags, captions region. *Done:* COMMENTARY cues over the pitch. *Missing:* the LOWER_THIRD and MOMENT_BANNER cue kinds, because the contract allows `COMMENTARY` only (`overlay-cue.schema.json:19`).
- [x] **DONE.** **Evidence Trail**: click an insight to replay the events behind it on a mini pitch. *Evidence:* event and tick evidence clips (#20); `tests/integration/analytics-browser.mjs:106-119`.
- [ ] **PARTIAL.** Player Spotlight view. *Done:* the Player focus filter (`match.html:352`; ADR 0014). *Missing:* a SPOTLIGHT persona (see A below).
- [ ] **PARTIAL.** CI/CD to Container Apps. Judge mode: seeded replay on demand with cached model and speech output. *Done:* CI/CD (#24; `build-images.yml` checks -> build -> deploy, passed for `08eafa9`), and recorded mode with the reviewed corner output (ADR 0017). *Missing:* speech output.
- [ ] **NOT STARTED.** Event Hubs adapter behind the ingest interface (Should). *Evidence:* no Event Hubs code in `app/`, `agents/` or `infra/`.

**A**
- [ ] **PARTIAL.** Swahili locale with glossary and native-speaker review. *Done:* `sw-KE` templates (`app/internal/ai/locales.go`, `agents/src/pulse_agents/locales/templates.py`). *Missing:* a glossary file and native review (`docs/LOCALE-REVIEW.md:3`, "PENDING HUMAN REVIEW").
- [ ] **NOT STARTED.** SPOTLIGHT persona. NEWCOMER and LOYALIST if time allows. *Evidence:* the persona enum is `CASUAL` and `ANALYST` only (`insight-request.schema.json:11`).
- [ ] **NOT STARTED.** Speech audio with word timings stored in Blob and referenced from the cue (Should). *Evidence:* no Speech code in `agents/src/`, `app/internal/` or `infra/`.
- [ ] **NOT STARTED.** Recap agent for half time and full time (Should). *Evidence:* only a deterministic downloadable recap exists (`app/web/templates/partials/experience.html:8`); there is no Recap agent.
- [ ] **NOT STARTED.** Pulse Daily (Should, after Speech and Recap work). Depends on Speech and the Recap agent.

### Play Fingerprint (Should, gated): DROPPED/PARKED on Oct 13

Full design in `docs/Pulse-Play-Fingerprint.docx`. **Parked:** the Oct 13 gate was NO-GO because there was no real-model path. None of FP1 to FP9 was started (no `similarPlays` field or retrieval code on `main`).

| ID | Task | Owner | Est. | Status |
|---|---|---|---|---|
| FP1 | Generator: recurring pattern templates and variety knobs for about 30 seeded filler matches | P | 0.5 d | DROPPED/PARKED (Oct 13) |
| FP2 | Tokeniser, attack-direction normalisation, pairing, 32-bit address | P | 0.5 d | DROPPED/PARKED (Oct 13) |
| FP3 | Index build and lookup with coherence voting, deterministic ordering | P | 0.5 d | DROPPED/PARKED (Oct 13) |
| FP4 | Golden, dropped-event, jitter and tempo, false-positive tests; config sweep | P | 0.5 d | DROPPED/PARKED (Oct 13) |
| FP5 | `SimilarPlay` schema, shared fixtures, Go and Python models | S | 0.25 d | DROPPED/PARKED (Oct 13) |
| FP6 | Fact pack fields and MCP tool `find_similar_plays` | P | 0.5 d | DROPPED/PARKED (Oct 13) |
| FP7 | Prompts, four Verifier `HISTORY_*` checks, 10 new eval cases | A | 1 d | DROPPED/PARKED (Oct 13) |
| FP8 | Viewer: "Seen before" chip and side-by-side mini pitch | P | 1 d | DROPPED/PARKED (Oct 13) |
| FP9 | README wording, judge instructions, 20-second demo beat | A | 0.25 d | DROPPED/PARKED (Oct 13) |

- [ ] **DROPPED/PARKED.** Gate passed on Tue Oct 13. The gate result was NO-GO.
- [ ] **DROPPED/PARKED.** FP4 pass bars met by Sat Oct 17 evening.
- [ ] **DROPPED/PARKED.** Stop at once if the Evidence Trail is not finished by Thu Oct 15. Moot, since the feature was parked.

**Integration day: Thu Oct 15 and Sun Oct 18.**

**Exit:** the full demo path runs on the public URL in judge mode, including Evidence Trail, two personas, Spotlight and Swahili. **PARTIAL:** the Evidence Trail, two personas and recorded mode run on the public URL. Spotlight is Player focus only. Swahili is unreviewed.

---

## Phase 4: Harden and freeze (Sun Oct 18 to Thu Oct 22)

- [x] **DONE: confirmed by Jefferson 17 Oct; portal not visible from repo.** Confirm registration is complete (the deadline is Tue Oct 20, 10:00 PM EAT).
- [ ] **PARTIAL.** Evaluation thresholds met. Verifier false-accept stays at zero. *Done:* offline 30/30, 0 false accepts. *Missing:* no live-model evaluation run.
- [ ] **PARTIAL.** Cost controls: model choice, caching, per-match caps, budget alerts verified. *Done:* `gpt-4.1-mini`; LRU cache of 128 (`service.py:81`); one workflow at a time (`service.py:56`); budget deployed. Every cap default is 0 since #30 (freeze item F). *Missing:* the budget currency is unconfirmed.
- [ ] **PARTIAL.** Accessibility pass: semantic HTML, aria-live captions, contrast, keyboard use. *Done:* an Oct 16 frontend audit was carried out; `aria-live` regions exist in `match.html`. Visible strings are routed through i18n since #32. *Missing:* the audit's P2/P3 items, and 215 aria and tooltip strings outside i18n (Known gaps).
- [ ] **PARTIAL.** README, architecture notes, decision records, data-quality report, judge instructions. *Done:* `README.md`, ADRs 0001-0022, `docs/metrics.md`. *Missing:* a data-quality report and judge instructions; no such file was found.
- [ ] **PARTIAL.** Public repo audit: no secrets, no real names or marks, licence present. Search the repo, UI strings, video script and README for third-party names (for example "Shazam") and remove them. *Done:* `THIRD-PARTY-NOTICES.md` and font OFL texts (#29). `git grep -i shazam` matches only `docs/Pulse-Play-Fingerprint.pdf` and this file. *Missing:* no project `LICENSE` file at the repo root (Known gaps). `.docx` files and the video script are not covered by `git grep`. No secret scan was run for this update.
- [ ] **PARTIAL.** README and UI footer state that the match library is synthetic. *Done:* `README.md:3`; the UI header badge reads "Synthetic fixture" (`match.html:76`). *Missing:* a footer statement. The "seeded recurring patterns" wording applied to Play Fingerprint, which is parked.
- [ ] **NOT STARTED.** Re-run the 15-minute SSE soak test and a cold-start test on the deployed app. *Evidence:* `docs/AZURE-LIVE-STATUS.md:114-115` says it is still pending. SSE does not exist.
- [ ] **NOT STARTED.** **Feature freeze Thu Oct 22.** Only fixes after this. See the Freeze plan.

**Exit:** a stable public URL, green CI, and a clean repo. **PARTIAL:** the URL is live and CI is green on `08eafa9`; the repo audit is incomplete.

---

## Phase 5: Demo and submit (Thu Oct 22 to Sun Oct 25)

- [ ] **NOT STARTED.** Script the video from the demo path. Under **2 minutes**, public URL, no third-party trademarks or copyrighted music, English or subtitled.
- [ ] **NOT STARTED.** Record, edit, upload to YouTube or Vimeo, and check it plays logged out.
- [ ] **PARTIAL.** Write the pitch: what we built, the Microsoft and Azure technologies used, what it does, the problem it solves. *Done:* a draft exists in `docs/PROJECT-PAGE.md`. *Missing:* the draft conflicts with other docs on live model use (Known gaps).
- [ ] **NOT STARTED.** Final run of the demo from a clean browser using only the submitted instructions.
- [ ] **NOT STARTED.** **Submit by Sun Oct 25.** Buffer Oct 26 to 27. The real deadline is Wed Oct 28, about 10:00 AM EAT.
- [ ] **PARTIAL.** Keep the deployment up and within budget until Nov 10. *Done:* live on Oct 17 (`/healthz` 200). *Missing:* the remaining days to Nov 10.

---

## Checkpoints and rhythm

| When | What |
|---|---|
| Daily, 15 minutes | What shipped, what is blocked, what changes in the contract |
| Fri Oct 9 | Skeleton works end to end |
| Tue Oct 13 | Real agents on real moments. Play Fingerprint go/no-go (result: NO-GO). |
| Sat Oct 17 | Play Fingerprint hard stop (moot: parked Oct 13) |
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
| Demo does not match video | Features appear in video that are unstable | Cut the feature from the video, not the test |
| Formation geometry dominates absolute control shares (from PR #19) | Issue #17 (open): the generator ignores `lineHeightM` and `compactness` | Never show shares as headline numbers. Use within-team change over time, labelled uncalibrated |
| Thin `CONTROL_SWING` margins (from PR #19) | The late-siege swing signals were 0.3026 and 0.3148 against a 0.30 threshold (measured in PR #19, not re-measured here) | `TestT13_Golden` asserts the full moments list, so a flipped swing fails CI |
| Golden parity across architectures (from PR #19) | The golden file was generated on amd64 only | Run the golden check on arm64 before relying on it there |
| Two-fixture tuning (from PR #19) | Thresholds tuned only on `late-siege` and `calm-midfield` | Do not claim calibration beyond these synthetic fixtures |

## Change log

Local UI update (Oct 14): Alex approved interface and deterministic-template
translation in English, Kiswahili and Hindi. Opt-in `hi-IN` is mirrored across
Go/Python and v2 locale enums with shared positive/negative cases. Select2,
responsive control spacing and persisted Casual/Analyst preferences are available
locally. Translations remain drafts for native-speaker review; non-English model
publishing is blocked and translated requests consume no model calls. No new
deployment or phase exit is claimed by this local iteration.

Main-release update (Oct 14): prototype experience promoted to `/`, with the
original dashboard preserved at `/legacy`. Reusable CI, container/browser gates
and separate main-only Azure identities support automatic image-only releases.
The existing contracts, cue gate, recorded mode and model cap are unchanged.
This release work does not complete streaming, broader agent or phase exit checks.

Readiness update (Oct 13): `feat/meeting-readiness` adds independently checked
agent publishing for the existing corner fact, canonical demo player identities,
tap/keyboard map inspection and a native local launcher. Contract v2 is unchanged.
One separately approved live Foundry CASUAL corner workflow now passes both gates.
Go/Python hosting is now deployed in recorded mode and verified on the public URL.
Broader facts/evaluations, streaming, tracing and clean-clone verification
by another teammate remain pending; these changes do not complete the phase exits above.

| Date | Change | By |
|---|---|---|
| Oct 27 | Added Dhruvi Parekh as the fourth registered team member (`AGENTS.md`, `README.md`, `PHASES.md`, `docs/`), updated submission/project-page copy for PR #49 (`aed03f9`), and refreshed the local demo capture. | Team |
| Oct 19 | Recorded Ved's confirmed permission for the Matchlens prototype (ADR 0015) and closed the Known gap. The team is three registered members: Jefferson, Alex and Ved. | Jefferson + Claude |
| Oct 18 | Rebased on `08eafa9`. Re-verified freeze rows F (#30) and A1–A6 (#32) as DONE, and re-ran the local checks plus `locale-browser.mjs`. Registration marked done on Jefferson's confirmation. Added the Matchlens reference hash to Decisions and the missing-LICENSE Known gap. | Jefferson + Claude |
| Oct 17 | Gave every item a status checked against `main` at `4aa3813`, with evidence. Added the Status key, Dates, Decisions, Freeze plan and Known gaps sections. Folded in the still-accurate parts of closed PR #19 (metrics decisions, metrics risks, contract v2.1 list). Dropped its outdated claims (Azure blocked, PR #18 in review). Play Fingerprint marked parked (Oct 13). | Jefferson + Claude |
| Oct 15 | Reviewed the supplied local prototype, fixed Select2/HTMX settle duplication and added replay browsing plus explicit fact-check provenance. Localisation drafts and UI tests do not complete native review, streaming, cloud reliability or broader agent evaluation. Feature review branch only until merged. | Alex + Codex |
| Oct 13 | Deployed Go/Python on Azure using GitHub-built, container-smoke-tested images. Public desktop/mobile checks pass for replay, all renderers, Story, charts/maps and evidence. Recorded Foundry mode makes no runtime model calls. Python insights require a service token; the reported internal-ingress boundary remains an Azure follow-up. Streaming/soak tests and broader agent evaluations remain pending. | Alex + Codex |
| Oct 5 | Initial plan for a two-person team (the team is now four registered members: Jefferson, Alex, Ved and Dhruvi Parekh; see the header) | |
| Oct 6 | Added Play Fingerprint (gated Should, tasks FP1 to FP9, Oct 13 gate, Oct 17 hard stop), Pulse Daily (Should, MP3 only), new cut-order positions, trademark and synthetic-data audit items, two risks | |
| Oct 6 | Contract v2 aligns field names, enums, locales and coordinates; preserve the corner demo, start with COMMENTARY and direct HTTP; message models/tests ready, runtime agents pending. | Alex + Codex |
| Oct 6 | Alex requested a local Three.js/PixiJS/SVG comparison before pushing. Replay clock and contracts unchanged; this experience spike does not complete the agent or SSE phases. | Alex + Codex |
| Oct 8 | Local corner fact builder, Python template HTTP pipeline, conservative Go gate and browser evidence replay connected. SSE, Azure and real model calls remain pending. | Alex + Codex |
| Oct 8 | Added three authored local scenario variants, attacking-route metrics, Casual/Analyst control, deterministic recap, opt-in mock-tested Foundry shadow adapter, container definitions, setup instructions and registration media. Goals need contract approval; Kiswahili needs review; live models, streaming and deployment remain pending. | Alex + Codex |
| Oct 11 | Integrated cached metrics/moments APIs with replay-backed team labels/statistics and control overlays in all three pitch renderers. Added event/tick evidence clips, neutral score state, gzip and millisecond timing checks (#9, #11, #13). Model values remain uncalibrated; tick evidence is not added to v2 FactPacks. Live agents, streaming and deployment remain pending. | Alex + Codex |
| Oct 12 | Added prototype-inspired Story filters, Go-backed pass/shot/entry charts, tracking-occupancy heatmaps and shot evidence on the separate experience branch. Shared v2 contracts and the gate are unchanged; these are source-data views, not live AI agents. Competition fit and reuse checks are recorded in ADR 0014. | Alex + Codex |
| Oct 13 | Ported the prototype visual system across working preview screens, with local fonts, dedicated Story/Insights/Recap, source-backed canvas charts/maps and a persistent optional watch dock. Source statistics and cue contracts remain Go-owned; unsupported prototype agent/social/game features remain deferred. | Alex + Codex |
