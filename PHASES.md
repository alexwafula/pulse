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
| **Should** | Event Hubs ingest. Speech voice with word-synced captions. Recap agent (half time and full time). Newcomer and Loyalist personas. Foundry traces shown in the demo. |
| **Won't** | Web PubSub, Foundry hosted agents, Producer Rundown, Match Radio, heads-up mode, Cosmos DB (use cookies or local JSON for profiles), broadcast hardware adapters, auto-eventing from video. |

**Cut order if behind** (first item goes first): Newcomer and Loyalist -> Recap agent -> Event Hubs (keep the in-process adapter) -> Speech audio (keep text captions) -> Player Spotlight -> Swahili (keep English).
**Never cut:** the golden path, the Verifier with fallback, the Evidence Trail, deployment, tests.

---

## Phase 0: Align and freeze (Mon Oct 5 to Tue Oct 6)

Goal: both engineers can work independently for three days without colliding.

**Both**
- [ ] Confirm the agent set: Explainer, Narrator, Verifier. Analyst and Producer are deterministic code in the engine, not LLM agents.
- [ ] Freeze **contract v1** for the golden path only. Events: PASS, SHOT, PRESSURE, CARRY, POSSESSION_CHANGE, WHISTLE. Cues: LOWER_THIRD, MOMENT_BANNER, PLAYER_TAG, STAT_CARD, COMMENTARY.
- [ ] Define the **agent messages** in `contracts/schemas/`: `FactPack` in, `NarrationDraft` out, `VerificationResult` out. This is the seam most likely to be missing.
- [ ] Choose the engine to agent boundary (HTTP service or MCP tool calls) and write a decision record in `docs/decisions/`.
- [ ] Fill in the Commands section of `AGENTS.md` with what really runs.
- [ ] Register for the hackathon, appoint the Representative, and create the project entry when the portal opens on Oct 6.

**P**
- [ ] Azure subscription, budget alert, and region chosen. Request Azure OpenAI quota now.
- [ ] Decide the order of work for the walking skeleton (see Phase 1).

**A**
- [ ] List the cases the evaluation set must cover (supported claim, invented claim, wrong number, over-long text, persona, locale).

**Exit:** contract v1 tagged, agent messages defined, boundary decision recorded, both registered.

---

## Phase 1: Walking skeleton (Tue Oct 6 to Fri Oct 9)

Goal: one command shows a verified cue on screen, with either side stubbed.

**P**
- [ ] Replayer reads `data/samples/first-sequence.json` and streams events in order (1x and 10x).
- [ ] Engine keeps match state and detects **one** moment (for example a line-breaking pass leading to a shot) with event IDs.
- [ ] Engine builds a fact pack and exposes it at the agreed boundary.
- [ ] Deterministic template builds a cue. **Cue gate** validates it against the contract.
- [ ] SSE delivery with heartbeats. `app/web/src/pitch.ts` shows the cue over a placeholder video or pitch.
- [ ] Deploy the skeleton to Azure Container Apps (even ugly) and run a 15-minute SSE soak test. Azure is the biggest unknown, so do it now.

**A**
- [ ] Agent service skeleton with the three agents returning canned, contract-valid output. Template-only mode works with no model.
- [ ] Evaluation harness reads `contracts/examples/` and runs end to end with a trivial agent.
- [ ] First real model call through Foundry with tracing visible.
- [ ] Draft the first 30 evaluation cases.

**Integration day: Fri Oct 9.** Wire real agent service to the engine. If it is not ready, ship with the template-only mode and keep going.

**Exit:** a seeded sequence replays, a cue passes the gate and appears in the browser on the Azure URL. `tests/integration/` has one passing test for it.

---

## Phase 2: Real intelligence (Fri Oct 9 to Tue Oct 13)

Goal: the system is smart, not just connected.

**P**
- [ ] Metrics v1 on a coarse grid every 500 ms: pitch control, pressing intensity, pass difficulty rating, normalised tactical entropy.
- [ ] Control vs Chaos index, validated against the scripted scenarios.
- [ ] Three moment types tied to three scenarios in `data/scenarios/` (for example late siege, red-card swing, pressing trap).
- [ ] MCP tool server exposing facts and calculations to agents.
- [ ] Data-quality checks on generated matches (pass accuracy, shots, possession ranges).
- [ ] Go tests: replay-based golden tests for metrics and moments.

**A**
- [ ] Explainer, Narrator and Verifier on real models with structured output.
- [ ] Retry once, then template fallback, with logged rejection reasons.
- [ ] Evaluation set of at least 30 cases. Verifier false-accept rate is zero on invented-claim cases.
- [ ] Prompts as files in `prompts/`. Cache by input hash.
- [ ] Persona support for CASUAL and ANALYST.

**Integration day: Tue Oct 13.** Real agents on real moments across all three scenarios.

**Exit:** three scenarios run end to end with real agents. The Verifier visibly rejects a bad draft and recovers. Evals are reported and trace screenshots exist.

---

## Phase 3: Experience and Azure (Tue Oct 13 to Sun Oct 18)

Goal: the demo path is complete and deployed.

**P**
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

**Integration day: Thu Oct 15 and Sun Oct 18.**

**Exit:** the full demo path runs on the public URL in judge mode, including Evidence Trail, two personas, Spotlight and Swahili.

---

## Phase 4: Harden and freeze (Sun Oct 18 to Thu Oct 22)

- [ ] Confirm registration is complete (the deadline is Tue Oct 20, 10:00 PM EAT).
- [ ] Evaluation thresholds met. Verifier false-accept stays at zero.
- [ ] Cost controls: model choice, caching, per-match caps, budget alerts verified.
- [ ] Accessibility pass: semantic HTML, aria-live captions, contrast, keyboard use.
- [ ] README, architecture notes, decision records, data-quality report, judge instructions.
- [ ] Public repo audit: no secrets, no real names or marks, licence present.
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
| Tue Oct 13 | Real agents on real moments |
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

## Change log

| Date | Change | By |
|---|---|---|
| Oct 5 | Initial plan for a two-person team | |
