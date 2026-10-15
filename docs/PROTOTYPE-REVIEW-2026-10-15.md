# Prototype review and remaining work

## Review scope

Reviewed on October 15 against the supplied local `Downloads/Front end/index.html`
export (551,931 bytes, October 12 modification time) and its README. This is a
Matchlens presentation reference, not Pulse's engine.

The [new Claude artifact](https://claude.ai/artifact/63LSmuF56GYZFhWPxcJpPf) returned
**Page not found** in Chrome; the web reader could not retrieve it either. The
export cannot be assumed identical to the inaccessible artifact. No standalone
claim-verification panel was found in the export. An updated export is required
to compare any newer fact-check design exactly.

Browser inspection covered Live, archive, all five Story pages and six persona
controls, all five Insights pages, all seven Feed pages, all five Play pages,
all four profile pages and the full-time recap. Source inspection covered their
simulation, rendering, narration, maps, storage, replay and AI modules. This is
a feature/presentation audit, not certification of every prototype action.
No model calls were made; the export reported `AI.ok=false` and no host bridge.

## Findings and disposition

| Prototype area | Finding | Pulse decision |
|---|---|---|
| Match hero, pitch and timeline | Clear separation of match, transport and story rail | Keep the prototype-inspired shell and persistent Three.js/PixiJS/SVG pitch |
| Previous matches | Thumbnail grid, duration, filters, search and replay actions | Apply that browsing pattern to real Pulse fixtures, not invented archive results |
| Replay thumbnails | Prototype renders its separate synthetic engine | Pulse previews use the first recorded tracking frame; counts/duration come from Go |
| Story | Live/Catch up/Highlights/Recap and audience controls | Existing views remain clock-bounded; Casual/Analyst and Player focus use actual events |
| Other personas/voices | Built-in wording; AI variants rely on the host | Defer new personas until grounding and language quality are tested |
| AI booth and Ask | Unavailable locally; minute citations extracted from prose | Do not copy unavailable controls or treat minute citations as factual proof |
| Mood Engine | Attractive pressure/threat/control presentation; separate formulas | Keep measured Pulse components and model-estimate labels; do not import numbers |
| Pitch maps | Team switch, networks, heatmap and pressure | Keep Go-backed maps; occupancy is player-time, not touches/pressure |
| Player duels | Ratings, speed/distance and comparisons | Defer until corresponding calculations and evidence contracts exist |
| Counterfactuals | Resimulates a match after changing a decision | Defer; hypothetical outcomes are not observed replay facts |
| Highlights/recap | Full-time compilation and personalised recap | Keep evidenced text recap; video/GIF and model recap are later work |
| Social pages | Reels, threads, notifications, saved posts; local fallback | Defer account/moderation/storage scope; sample activity is not real collaboration |
| Watch parties/leagues | Need host/database support | No buttons for services Pulse does not implement |
| Games/rewards/fantasy | Separate entertainment surface | Outside the current facts-first demo scope |
| Settings/onboarding | Persistent preferences and languages | Keep English/Kiswahili/Hindi preferences; native review remains pending |
| Fact checks | Data-oriented prompts/citations, no compatible independent verification | Show Pulse's actual verification, fact/event IDs and window; never import a trust badge |

## Changes in this branch

- Select2 now initializes after **HTMX settle**, not after swap. HTMX restores
  class/style attributes during settle; early enhancement left a widget present
  while revealing its original native select. Explicit CSS also protects hiding.
- One widget per select, one open menu at a time, proper cleanup and keyboard
  tests using real widgets. Map clicks synchronize the displayed selection
  without triggering an unnecessary data refresh.
- One Scenarios launcher replaces the homepage dropdown/permanent demo button.
  The legacy route keeps its selector. Stop appears only during a guided demo.
- A keyboard-accessible dialog borrows archive browsing: recorded-position
  thumbnails, search, 11v11/short filters, durations, current scenario,
  loading/error/retry and no-results states. Only available fixtures are listed.
  Replay links preserve locale/persona/renderer.
- Guided demo reuses replay -> cue -> evidence -> recap. Completion opens the
  usable Recap screen instead of scrolling to a hidden legacy panel.
- Fact check exposes publication status, passed/checked claims, verifier reasons,
  fact IDs, window and clickable source events. Templates say **Not model-verified**;
  recordings remain **Verified (recorded)**.
- Includes previously approved English/Kiswahili/Hindi UI and deterministic
  template work. Non-English model publication stays blocked; translations are
  drafts pending native review. No publication gate was weakened.

## Verification

Go tests/vet, 29 Python unit tests, TypeScript/build, dependency audit and both
seeded fixture quality checks pass. Offline fake-backend boundary evaluation:
30/30, zero false accepts; this does not measure live LLM quality.

Browser suites pass for core behavior, replay analytics, all renderers/cameras,
Story, charts/maps, SVG fallback, evidence, retries and recaps. New regressions
cover native-control duplication after repeated HTMX swaps, all three locales
and both personas, gallery and fact checks at 320/390/768/1440 pixels. Homepage
checks include nonblank Three.js pixels on desktop/mobile.

```powershell
$env:PULSE_URL = 'http://127.0.0.1:8080'
$env:PULSE_INSIGHT_SOURCE = 'python-recorded'
npm run test:controls
npm run test:library
node tests/integration/homepage-browser.mjs
node tests/integration/core-browser.mjs
node tests/integration/analytics-browser.mjs
npm run test:experience
```

## Azure and Foundry

Read-only checks on October 15 confirmed:

- Main CI and Build Azure Images succeeded for `88a5b7de04c7f690b5951d140f8b59e329449890`.
- Both apps use that image tag and report Running/Succeeded. Public web and
  Python health checks pass; Python reports `recorded`.
- Unauthenticated `POST /insights` returns 401. Azure reports internal Python
  ingress while direct health remains reachable: network isolation is not proven.
- `pulse-insights` / `gpt-4.1-mini` deployment reports `Succeeded`. Production
  remains recorded with `PULSE_MODEL_REQUEST_CAP=0`, no live-model configuration.
  Provisioning does not mean ongoing fresh AI analysis.
- This branch is review work, not the current Azure image. Main push/merge
  triggers the gated release; feature-branch push does not replace production.

Before calling cloud work complete:

1. Review/merge this branch; verify the released SHA and public desktop/mobile
   walkthrough after the deployment workflow succeeds.
2. Resolve Python ingress; retain service-token authentication regardless.
3. Verify log ingestion/retrieval, cold-start fallback and a 15-minute replay/API
   soak. Streaming/SSE is still unimplemented.
4. Decide whether the judged demo needs fresh output or labelled recordings.
   Fresh output needs approved bounded spending, secret/runtime configuration
   and held-out scenarios. Do not enable it silently.
5. Connect/review tracing; record latency, fallbacks, rejections and token use.
   Traces live in Application Insights and additional monitoring charges can
   apply: [Microsoft tracing guidance](https://learn.microsoft.com/en-us/azure/foundry/observability/concepts/trace-data).
6. Run actual model evaluations before quality claims; obtain native
   Kiswahili/Hindi review before calling translations reviewed.

No cloud resources, deployment settings or live-model limits were changed.
Remaining credits and alert delivery were not checked.

## Next priorities

1. Expand Go fact packs for existing attacking routes/detected moments, adding
   negative evidence/window tests before extending agent wording.
2. Record a concise working end-to-end demo; another collaborator should rehearse
   from a clean clone before feature freeze.
3. Finish cloud observability/reliability, then bounded live-agent evaluations.
   Avoid another frontend or service migration before the demo.
