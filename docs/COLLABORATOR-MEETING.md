# Collaborator meeting

## Start the local demo

Prerequisites: Go, Python 3.11+, Node and Chrome for browser tests. From the repo:

```powershell
npm ci
.\scripts\start-local.ps1
```

Use the printed Preview/Stadium URLs, not a guessed port. The script uses template
mode, binds both services to localhost, leaves unrelated processes alone and
reports process IDs and logs. Use `-SkipWebBuild` for committed browser assets.
Stop only the printed Pulse process IDs when finished:

```powershell
Stop-Process -Id <WebPID>, <AgentPID>
```

Docker alternative: `docker compose up --build`, then localhost:8080/experience.
Docker has not been tested on Alex's machine because it is not installed.
Foundry setup and its explicit opt-in: [setup guide](FOUNDRY-AZURE-SETUP.md).

## Review in this order

1. Corner chance: play through the blocked shot, inspect the cue evidence, compare
   Casual/Analyst. A shot is not a goal. Template status is displayed honestly.
2. Late siege: inspect the stadium, Story modes, source charts, both team heatmaps,
   and passing nodes. Use pointer/touch and native keyboard selectors.
3. Rewind: future counts/evidence disappear. Change sections and return to Live;
   the pitch and replay clock must survive. Complete the sequence and download recap.
4. Run the recorded three-agent integration test. It demonstrates verified output,
   caching and unsafe-goal fallback, not live Foundry model quality.

```powershell
go test ./...
go vet ./...
py -m unittest discover -s agents/tests -v
py tests/evaluations/run_agents.py
py tests/integration/agents-flow.py
node scripts/reconcile-rosters.mjs
```

## Ownership to confirm

| Work | Proposed owner | Acceptance |
|---|---|---|
| Experience, charts, mobile and accessibility | Frontend collaborators | Existing API/clock, no invented statistics, browser checks pass |
| Replay, squads, metrics and cue gate | Alex / engine owner | Deterministic output and complete source evidence |
| Explainer, Narrator, Verifier and evaluations | AI owner | Independent policy checks; unsupported claims fall back |
| Preview environment and final demo | Named release owner | Another teammate runs setup; shared URL and end-to-end checklist |

API and contribution boundaries: [frontend integration](FRONTEND-INTEGRATION.md).
UI review: [PR #21](https://github.com/alexwafula/pulse/pull/21).
Do not merge readiness work into the UI PR silently. Agree reviewer and merge order.

## Decisions to leave with

- Named owners and reviewers, one shared API boundary, and a review date.
- Confirm the roster audit for issue #14 and pressing semantics for issue #10.
  Issue #12 scenario realism and #17 reserved tactical knobs remain separate work.
- One golden path: replay -> detected corner/shot -> checked explanation -> evidence
  -> source recap. A broader tactical explanation needs broader calculated facts.
- Schedule one budget-approved Foundry smoke test and a shared Azure preview.
  No cloud resources or paid calls were made for this readiness work.
- Keep English only until Kiswahili review; do not promise goals, xG, additional
  agent personas, social features or arbitrary AI prose that are not implemented.

## Local verification (2026-10-13)

- Go tests, vet and formatting: passed.
- Python: 21 unit tests passed. Thirty recorded adversarial cases passed in both
  shadow and publishing modes, with zero false accepts on that offline set.
  These are boundary checks, not measured live model accuracy.
- Fourteen shared positive/negative publication-language cases passed in Go/Python.
- Actual Python HTTP -> Go gate test: both audiences, complete evidence, cache,
  unsafe-goal fallback and template mode passed with a recorded backend.
- Core, analytics, pitch and experience browser suites: passed on desktop/mobile,
  including all three renderers, canvas pixel checks, tap/keyboard map inspection,
  SVG fallback, Verified/Template labels and source-clock/evidence recovery.
- Roster audit and both seeded-scenario data-quality checks: passed.
- Native launcher: two-service startup/health/template boundary and occupied-port
  handling passed. Only extra test processes were stopped; the demo stays running.
- Bicep template and parameters: compiled successfully. No resources deployed.
- Docker, a teammate's clean-clone run and shared Azure app preview: not verified.
  Team review and issue closure are still pending.
- Foundry follow-up: resource/project/model deployed in South Africa North,
  one live CASUAL corner workflow passed Python/Go validation, desktop/mobile
  browser checks passed, and subsequent browser requests used the cached response.
  The demo service is capped at one workflow per process; this is not a model-quality
  evaluation or evidence that all personas/scenarios have been tested live.
