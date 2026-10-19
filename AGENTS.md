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
The corner-to-first-shot builder, conservative independently checking Go cue gate,
Python template HTTP service and browser Evidence replay now work locally.
Go-calculated passing snapshots and pass evidence are rendered below the pitch.
Python has file prompts and a tested bounded three-role workflow. Default HTTP
mode is template-only; opt-in `foundry` can publish only approved corner-shot
wording after independent Python/Go checks. `foundry-shadow` still publishes
templates. Recorded publishing tests are not evidence of live model quality.
Three authored local scenarios plus seeded 11v11 late-siege/calm-midfield replays,
attacking-route metrics, persona controls and
a deterministic downloadable recap are available. An opt-in Foundry REST
adapter is mock-tested; the Foundry resource/project and gpt-4.1-mini deployment
are provisioned in South Africa North. One bounded live corner workflow passed
both Python and Go checks; Go/Python app hosting now works on Azure. Dockerfiles/Compose and
setup/project-page docs are prepared.
An explicit `recorded` mode packages the reviewed live corner output, validates
it at startup and binds it to the complete request. It makes no model calls and
is labelled `Verified (recorded)`. ACR Tasks are blocked by this subscription;
GitHub builds and smoke-tests images through registry-scoped federation instead.
Both apps are deployed and tested on the public Azure URL. Python insights require
a service token: Azure reported internal ingress, but direct requests still
reached the endpoint. Health stays public; untrusted insights requests return 401.
See `docs/AZURE-LIVE-STATUS.md` for verified scope and remaining cloud checks.
Cached metrics/moments APIs and clock-synchronised control overlays now work
in SVG, Three.js and PixiJS. Replay-backed statistics and event/tick evidence
clips are available. Tracking values are uncalibrated model estimates, not
agent facts under v2. CONTROL_SWING context events must never be cited as
evidence; its evidence is metric ticks. Scores remain unavailable, not 0:0.
SSE remains unimplemented. Explainer/Narrator/Verifier are wired to the
opt-in Foundry backend; one live CASUAL corner workflow has been verified, not
broader model quality or latency. The Go gate still
rejects free prose, unsupported facts and incomplete evidence.
The homepage uses locally bundled HTMX for replay-clock
Story/Recap HTML panels; its pitch stays mounted. Live/Insights reuse the existing
controller and gated cue feed. The preview now ports the supplied stadium and
articulated character presentation; textured kits/ball and close perspective
cameras replace the original capsule-and-number view. `/experience` remains an
alias; `/legacy` preserves the original view, unlinked from the nav. The homepage defaults to
late-siege; API defaults stay corner, so always send the selected scenario.
Gait uses recorded tracking velocity and the replay clock, never a second timer
or inferred ball flight. The model field is opt-in in the preview.
Story now includes clock-bounded Catch up, source-event Highlights and Player
focus with Casual/Analyst detail; Player focus is a presentation filter, not a
new agent persona. Insights shows Go-backed cumulative pass/shot/entry charts,
attack-relative lane counts, team tracking-occupancy heatmaps and evidenced shot
locations. Occupancy is sample-and-hold player-time, not touches or pressure.
The preview now uses the prototype's neutral/blue visual system and locally
served Outfit/Jakarta fonts across Live, Story, Insights, Recap and evidence.
Dedicated screens move the existing pitch into an optional watch dock; transport
and renderer nodes are reused, never recreated by navigation. Chart/map canvases
paint Go paths/cells with SVG fallback. Passing-map positions average elapsed
completed-pass involvement locations. Soft heat shading is presentation only;
source cell time, sample intervals and evidence remain available.
Contributor routes and DOM events are documented in `docs/FRONTEND-INTEGRATION.md`.
The readiness branch adds deterministic sustained-pressure presentation with
source events and ticks, explicitly Template / Not model-verified. It is not a
new v2 cue or agent fact pack. Moment clips stay in Live; persona/locale changes
preserve detector clips. Static assets use gzip and conditional revalidation,
never immutable caching on unfingerprinted URLs; HTML pages and panels are gzipped too. Human submission sign-offs are
tracked in `docs/SUBMISSION-READINESS.md`; none are certified by automated tests.
Original provider/run evidence for the corner recording is pending; its manually
declared metadata is not attestation (`docs/RECORDING-PROVENANCE.md`).
Main releases reuse CI, test both containers and the desktop/mobile homepage,
then publish SHA-tagged images and update the existing Azure apps. Separate
main-only identities grant registry push and app-scoped deployment access.
Recorded mode, zero model calls and service-token authentication are preserved.
On Live, a hero states the API's `indexDelta` as one plain line (2 dp) with its exact
signed value (U+2212), team-order label and estimate chip; there is no score or share
meter. The server renders the first headline from the cached `/api/metrics` result and
the team kits from team ids (`team_kit.go`); scripts only read and update them.

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
- Changing a contract: update the schema, the examples, `contracts/README.md`, and both Go and Python models in the same change. Bump `schemaVersion` for breaking changes. Tell the other engineers first.
- Conventions: IDs are strings matching `[A-Za-z0-9_.:-]{1,64}`; timestamps are UTC ISO-8601 with milliseconds; pitch is 105 by 68 metres with origin bottom-left; scores and probabilities are 0 to 1; enums are `UPPER_SNAKE`.

Rules from the broader contract draft (verify in `contracts/`; several below
remain future work). Current golden path supports the six existing replay
event kinds, COMMENTARY cues, CASUAL/ANALYST and en-GB/sw-KE/hi-IN templates:

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

Current set: **Explainer, Narrator, Verifier**, run by a thin async workflow with
an opt-in Foundry REST backend. The publishing path is constrained to the recorded
corner-shot fact, tested with fake backends and one approved live workflow, not
broad live-model evaluations. Microsoft Agent
Framework, Recap, and additional personas remain future work.

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

- Interface/template locales: `en-GB`, `sw-KE`, `hi-IN`. Alex confirmed native-language/Swahili review with no issues on Oct 18; individual reviewers and separate Hindi review scope are not named (`docs/LOCALE-REVIEW.md`). Model-backed publication remains English-only and translated requests make no model calls.
- If a football term has no established term in the glossary, keep the English term. Never invent terms.
- Swahili output is reviewed by a native speaker before the demo.

### 7.5 Evaluations

`tests/evaluations/` holds the evaluation set. Include supported claims, invented claims, wrong numbers and persona/locale cases. Report pass rate per agent and keep the Verifier's false-accept rate at zero on the invented-claim cases. Never change expected results to raise a score.

## 8. Commands

Known from `package.json`:

- `npm run build:web` bundles `app/web/src/pitch.ts` with esbuild.
- `npm run check:web` runs `tsc --noEmit`.
- `npm run test:web` runs `tests/integration/pitch-browser.mjs`.
- `npm run test:experience` runs the integration preview browser checks against
  a running Go server (`PULSE_URL` selects the URL).

Local checks:

- Full gate: `./scripts/check.sh` runs 10 steps: gofmt, go vet, Go tests (plus `-race` on the shared metrics cache test), checkdata on every generated scenario in `data/scenarios`, Python tests, agent evaluations, tsc, esbuild, web bundle reproducibility, Bicep.
- Go: `go build ./...`, `go vet ./...`, `gofmt -l .`, `go test ./...`
- Python: `py -m unittest discover -s agents/tests -v` (standard library; pytest is not configured)
- Offline agent boundary evaluation: `py tests/evaluations/run_agents.py` (fake backend, not model accuracy)
- Core UI: `node tests/integration/core-browser.mjs` (running local Go server required)
- Replay analytics: `node tests/integration/analytics-browser.mjs` (running local Go server; set `PULSE_URL` and, if needed, `CHROME_PATH`)
- Default homepage: `node tests/integration/homepage-browser.mjs` (desktop/mobile, stadium pixels and routing)
- UI controls: `node tests/integration/controls-browser.mjs` (Select2, all locales/personas, persistence, menu stability and 320/390/768/1440px layouts)
- Locales and model labels: `node tests/integration/locale-browser.mjs` (running local Go server; locale allowlist and storage, hi-IN catalog routing, Control vs Chaos `indexDelta` headline, canonical `model estimate, uncalibrated` label, translated insights never Verified)
- Render loop: `node tests/integration/render-loop-browser.mjs` (running local Go server; counts WebGL draw frames while paused, playing and hidden)
- Hero (D3a): `node --test tests/integration/index-headline.test.mjs` (headline wording) and `node tests/integration/hero-browser.mjs` (running local Go server; server-rendered team kits and headline present before scripts and unchanged by hydration, headline equals `/api/metrics`, mobile pitch within 360px, paused renderer switch draws 0 frames)
- Design tokens: `node tests/integration/tokens-browser.mjs` (running local Go server; team colour by identity across scenarios and renderers, audited contrast pairs, no Inter on `/`, `/legacy` pixels against `PULSE_LEGACY_BASELINE`, reduced-motion scrolling)
- Replay library: `npm run test:library` (fixture-backed previews, filters, dialog focus, guided demo, fact-check provenance and evidence links)
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
- Working in another engineer's area or deleting fixtures and tests.

Never:

- Commit secrets or `.env`, weaken validation, skip or delete failing tests, or edit expected eval results to pass.
- Invent football data, use real names, or call paid APIs in loops or tests without caching.

## 11. Ownership and handoffs

Three registered engineers: Jefferson, Alex and Ved.

- **Pipeline engineer:** `app/`, `data/`, `infra/azure/`, web shell and overlay island, engine metrics, MCP tool server, cue gate, delivery.
- **Agents engineer:** `agents/`, prompts, locales, `tests/evaluations/`, Speech integration, Foundry wiring and tracing.
- **Design engineer (Ved):** the Matchlens prototype that is the visual basis of the UI (ADR 0015) and the design direction (`docs/design/DIRECTION.md`).
- **Shared:** `contracts/`, `tests/integration/`, `docs/`, CI. Announce changes before merging.

The two sides stub each other: the engine ships recorded fact packs, the agent service ships a template-only mode. Neither side blocks on the other.

## 12. Definition of done

A task is done when it builds, its checks and tests pass, contracts and examples agree, docs are updated, no secrets are present, and it works on the golden path without special setup.

## 13. Open items

Tracked in `docs/decisions/`: agent hosting (Container Apps versus Foundry hosted agent), delivery transport (SSE only versus plus Web PubSub), Event Hubs timing, Azure region and model quota, profile storage.
