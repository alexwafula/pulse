# AGENTS.md

Shared guide for every agent that works in this repo: AI coding assistants (Antigravity, Claude Code, Copilot and others) and the Pulse runtime agents (Explainer, Narrator, Verifier). Read this first, then `PHASES.md` to see what is being worked on now.

Keep this file short and true. If the repo no longer matches it, fix the file in the same change.

## 1. What Pulse is

Pulse turns **synthetic football events** into explainable match intelligence: live insights, narratives and recaps, personalised per viewer and shown as overlays beside a match. It is our entry to the Microsoft x Premier League hackathon "Inside the Game".

Pipeline: **Ingest -> Interpret -> Explain -> Render -> Personalize**.

Core idea: **facts first, LLM second.** Go computes every number and detects every moment deterministically. Agents only turn those facts into words, and a Verifier checks every claim against source events before anything reaches a viewer.

## 2. Non-negotiable rules

1. **Synthetic and fictional only.** No real match data. No real clubs, players, leagues, crests or logos in code, fixtures, prompts, docs, screenshots or the demo. Use the fictional league in `data/`.
2. **Never invent football.** Every number, name and comparison in generated text must come from the fact pack for that moment.
3. **Every narrative cue carries evidence.** LOWER_THIRD, MOMENT_BANNER, COMMENTARY and RECAP cues must cite at least one source event ID and a verification result.
4. **The Go cue gate is the last line of defence.** It rejects any cue that breaks the contract. Do not weaken or bypass it to make a test or demo pass.
5. **Deterministic and seeded.** Same seed, same match, same metrics. No wall-clock or random values in metrics or moments.
6. **Measure, do not claim.** Only report latency, accuracy or scores we measured. The video must show only what works.
7. **No secrets in the repo.** Keys live in environment variables and Azure Key Vault. Update `.env.example`, never `.env`. The repo is public.
8. **No betting, alcohol or political content** anywhere, including examples.

## 3. Repo map

Confirm against the tree before relying on it.

| Path | What it holds | Owner |
|---|---|---|
| `app/cmd/` | Go entrypoints (engine, replayer, web server) | Pipeline |
| `app/internal/` | Go packages: domain model, metrics, moments, cue gate, delivery | Pipeline |
| `app/testdata/` | Go test fixtures | Pipeline |
| `app/web/` | htmx templates and static files. `web/src/pitch.ts` is the TypeScript overlay island, bundled by esbuild | Pipeline |
| `agents/src/pulse_agents/` | Python agent service. `prompts/` holds prompt files, `locales/` holds per-language glossaries | Agents |
| `agents/tests/` | Python unit tests | Agents |
| `contracts/schemas/` | JSON Schema for events, tracking, match metadata, cues and agent messages | Shared |
| `contracts/examples/` | Valid and invalid example payloads used by every language's tests | Shared |
| `data/samples/` | Small sample sequences, for example `first-sequence.json` | Pipeline |
| `data/scenarios/` | Scripted storylines (late siege, red-card swing, pressing trap) | Pipeline |
| `tests/evaluations/` | Agent evaluation sets and runners | Agents |
| `tests/integration/` | End-to-end tests, for example `pitch-browser.mjs` (Playwright) | Shared |
| `infra/azure/` | Infrastructure as code (Bicep) | Pipeline |
| `docs/decisions/` | Short decision records. Add one for any architectural choice | Shared |
| `.github/` | CI workflows | Shared |

## 4. Architecture on one screen

This is the target architecture, not the current implementation. Current: Go
replay and HTTP fixture API, Go templates, TypeScript pitch, contract v2,
Go/Python agent-message models and dependency-free contract tests. A local
Three.js/PixiJS comparison now sits beside the SVG view, using the same replay.
The corner-to-first-shot builder, conservative canonical-template Go cue gate,
Python template HTTP service and browser Evidence replay now work locally.
Go-calculated passing snapshots and pass evidence are rendered below the pitch.
Python has file prompts and a tested async shadow workflow; it does not publish
model output, and the HTTP endpoint remains template-only.
Three authored local scenarios, attacking-route metrics, persona controls and
a deterministic downloadable recap are available. An opt-in Foundry REST
shadow adapter is mock-tested; no live calls or cloud deployment have been
verified. Dockerfiles/Compose and setup/project-page docs are prepared.
SSE, model-backed runtime agents and Azure remain unimplemented. The Python
Explainer/Narrator/Verifier-shaped stages are deterministic replacement points.

```
Generator/replayer (Go) -> Event Hubs -> Match engine (Go, Container Apps) <-MCP-> Agent service (Python)
                                                                                      |  Foundry models, traces
Viewer (htmx + TS island) <- Delivery (SSE; Web PubSub optional) <- Cue gate (Go) <---+  Speech -> Blob audio
```

How one moment flows:

1. Replayer streams a seeded match (events plus about 5 Hz tracking).
2. Engine updates match state, computes metrics, detects a **moment** with its source event IDs, and builds a **fact pack**.
3. Agents turn the fact pack into a draft: Explainer (why it matters), Narrator (words for a persona and locale).
4. Verifier checks every claim. After two rejections the system uses a deterministic template.
5. Speech (optional) renders audio and word timings.
6. Producer logic (plain Go code, not an LLM) builds the **cue**.
7. Cue gate validates the contract. Delivery pushes it. The island draws it over the video.

Deterministic work (metrics, moment detection, cue building, validation) is **code**, not an agent.

## 5. Contracts

`contracts/` is the seam between the Go engine, the Python agents and the TypeScript island. It is authoritative: if this file disagrees with `contracts/`, `contracts/` wins.

- Structure lives in JSON Schema. **Business rules live in code in each language**, guarded by shared examples. A schema alone catches only part of the rules.
- **No rule without an invalid example.** Adding or changing a rule means adding a valid and an invalid case in `contracts/examples/`, then making every language's tests pass.
- Changing a contract: update the schema, the examples, `contracts/README.md`, and both Go and Python models in the same change. Bump `schemaVersion` for breaking changes. Tell the other engineer first.
- Conventions: IDs are strings matching `[A-Za-z0-9_.:-]{1,64}`; timestamps are UTC ISO-8601 with milliseconds; pitch is 105 by 68 metres with origin bottom-left; scores and probabilities are 0 to 1; enums are `UPPER_SNAKE`.

Rules from the broader contract draft (verify in `contracts/`; several below
remain future work). Current golden path supports the six existing replay
event kinds, COMMENTARY cues, CASUAL/ANALYST and en-GB/sw-KE only:

- A completed pass has a recipient. A possession change is between two different teams and `teamId` is the team that gains the ball.
- Narrative cues need at least one evidence event and verification status `VERIFIED` or `FALLBACK_TEMPLATE`. Data-only cues use `NOT_REQUIRED`.
- `VERIFIED` needs at least one checked claim and every checked claim passing. `claimsPassed` never exceeds `claimsChecked`.
- A LOWER_THIRD headline has fewer than 15 words. COMMENTARY has 1 to 4 lines of at most 400 characters. A MOMENT_BANNER body is at most 240 characters.
- Persona `SPOTLIGHT` requires `spotlightPlayerId`. Persona `LOYALIST` requires `favouriteTeamId`.
- A pitch-control grid has exactly `cols * rows` values. Caption `endMs` is not before `startMs`.

## 6. Domain glossary

| Term | Meaning |
|---|---|
| Event | One discrete match action: pass, shot, tackle, duel, carry, pressure, possession change, card, substitution, whistle |
| Phase / possession chain | An uninterrupted spell of possession, identified by `phaseId` |
| Pitch control | Probability a team reaches a location first, 0 to 1 per grid cell |
| Pressing intensity | Chance at least one defender reaches the ball carrier within about 1.5 s, 0 to 1 |
| PDR (pass difficulty rating) | Chance an average professional fails the pass, 0 to 1 |
| Tactical entropy | Chaos versus structure of the control surface, normalised 0 to 1 |
| Control vs Chaos index | Headline 0 to 1 score blending control share, inverse entropy, pressing and shot quality |
| Moment | A detected significant point (momentum swing, milestone, pressing trap) with `reasons` as event IDs |
| Fact pack | The only facts an agent may use for one moment, each tied to source event IDs |
| Cue | A timed, machine-readable overlay or narration for a channel and audience |
| Evidence Trail | UI that replays the events behind an insight |
| Persona | CASUAL, ANALYST, NEWCOMER, LOYALIST or SPOTLIGHT |

## 7. Pulse runtime agents

Planned set: **Explainer, Narrator, Verifier**, run by a thin orchestrator workflow on Microsoft Agent Framework with Foundry models. The runtime agents are not implemented yet. Candidates after the golden path works: Recap agent, and splitting Persona/Locale out of the Narrator.

### 7.1 Rules for every Pulse agent

- Use only facts in the fact pack. If a fact is missing, say less. Never fill gaps.
- Copy numbers and names exactly. No rounding that changes meaning, no new comparatives ("fastest", "first", "best") unless the fact pack states it.
- Fictional names only. No betting, odds, real clubs or real people.
- Output must match the schema in `contracts/schemas/`. Return structured output, never free text with embedded JSON.
- Prompts live in `agents/src/pulse_agents/prompts/` as files. No long prompt strings inside code.
- Be cheap: short prompts, small model on the live path, cache by hash of input, no unbounded retries.

### 7.2 Roles

| Agent | Input | Output | Must not |
|---|---|---|---|
| Explainer | Fact pack with Control vs Chaos before and after | A short "why it matters" statement, each claim tagged with fact IDs | Add facts, speculate on intent or injuries |
| Narrator | Explainer output, audience (persona, locale) | Draft cue text for the requested payload kind, claims tagged with fact IDs | Exceed length rules, change numbers, mix personas |
| Verifier | Draft text, fact pack | Per-claim result (supported or not, with event IDs) and overall `VERIFIED` or `REJECTED` | Rewrite the draft, approve unsupported claims, be lenient to pass evals |

Failure handling: Verifier rejects -> Narrator retries once with the rejection reasons -> second rejection -> deterministic template with status `FALLBACK_TEMPLATE`. Log every rejection with its reason. Model errors or timeouts also fall back to the template, and the deterministic insight still ships.

### 7.3 Personas

- CASUAL: plain words, momentum and emotion, no jargon.
- ANALYST: numbers, thresholds and the reason chain. Concise.
- NEWCOMER: explains the football idea as it happens, then the moment.
- LOYALIST: same facts framed from the favourite team's side. Framing changes, facts never do.
- SPOTLIGHT: focuses on one player's involvement in the moment.

### 7.4 Locales

- Supported: `en-GB`, `sw-KE`. Generate natively from facts using the glossary in `locales/`. Do not translate finished English.
- If a football term has no established term in the glossary, keep the English term. Never invent terms.
- Swahili output is reviewed by a native speaker before the demo.

### 7.5 Evaluations

`tests/evaluations/` holds the evaluation set. Include supported claims, invented claims, wrong numbers and persona/locale cases. Report pass rate per agent and keep the Verifier's false-accept rate at zero on the invented-claim cases. Never change expected results to raise a score.

## 8. Commands

Known from `package.json`:

- `npm run build:web` bundles `app/web/src/pitch.ts` with esbuild.
- `npm run check:web` runs `tsc --noEmit`.
- `npm run test:web` runs `tests/integration/pitch-browser.mjs`.

Local checks:

- Full gate: `./scripts/check.sh` runs 10 steps: gofmt, go vet, Go tests, checkdata on every generated scenario in `data/scenarios`, Python tests, agent evaluations, tsc, esbuild, web bundle reproducibility, Bicep.
- Go: `go build ./...`, `go vet ./...`, `gofmt -l .`, `go test ./...`
- Python: `py -m unittest discover -s agents/tests -v` (standard library; pytest is not configured)
- Offline agent boundary evaluation: `py tests/evaluations/run_agents.py` (fake backend, not model accuracy)
- Core UI: `node tests/integration/core-browser.mjs` (running local Go server required)
- Shared agent business-rule examples: `go test ./app/internal/domain` and the Python command above. A complete cross-language schema runner remains future work.

## 9. Code conventions

- **General:** clean and maintainable beats clever. Model the domain first: entities, relationships and boundaries before code. Small functions, clear names, no dead code, comments explain why.
- **Go:** standard layout, packages by domain under `app/internal/`, interfaces defined where they are used, errors wrapped with `%w`, `context.Context` passed through, no package-level mutable state, table-driven tests.
- **TypeScript:** `strict`, no `any`, no framework in the island, small modules, keep the `<video>` element outside any htmx-swapped region.
- **Python:** type hints everywhere, Pydantic models mirror `contracts/`, async for I/O, tests with pytest, deterministic tests (no live model calls unless marked and cached).
- **Tests:** new behaviour ships with tests. Prefer replay-based golden tests for the engine.
- **Commits:** professional, imperative, `type(scope): summary`. One logical change per commit. No secrets, no generated noise.

## 10. Working agreement for coding agents

Do:

- Read `PHASES.md` and work on the current phase only.
- Keep changes small and in the owner's area. Run the relevant checks before finishing.
- Add or update tests and `docs/decisions/` entries with the change.
- State assumptions and anything you could not verify.

Ask a human first before:

- Changing anything in `contracts/` or a Go/Python model that mirrors it.
- Adding a dependency, changing CI, or creating or changing Azure resources that cost money.
- Working in the other engineer's area or deleting fixtures and tests.

Never:

- Commit secrets or `.env`, weaken validation, skip or delete failing tests, or edit expected eval results to pass.
- Invent football data, use real names, or call paid APIs in loops or tests without caching.

## 11. Ownership and handoffs

- **Pipeline engineer:** `app/`, `data/`, `infra/azure/`, web shell and overlay island, engine metrics, MCP tool server, cue gate, delivery.
- **Agents engineer:** `agents/`, prompts, locales, `tests/evaluations/`, Speech integration, Foundry wiring and tracing.
- **Shared:** `contracts/`, `tests/integration/`, `docs/`, CI. Announce changes before merging.

The two sides stub each other: the engine ships recorded fact packs, the agent service ships a template-only mode. Neither side blocks on the other.

## 12. Definition of done

A task is done when it builds, its checks and tests pass, contracts and examples agree, docs are updated, no secrets are present, and it works on the golden path without special setup.

## 13. Open items

Tracked in `docs/decisions/`: agent hosting (Container Apps versus Foundry hosted agent), delivery transport (SSE only versus plus Web PubSub), Event Hubs timing, Azure region and model quota, profile storage.
