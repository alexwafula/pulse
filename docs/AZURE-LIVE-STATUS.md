# Azure live deployment

## Main release path

The homepage is the prototype-inspired experience, with `/experience` retained
as an alias and the original dashboard at `/legacy`. Main releases run reusable
CI, container/API and desktop/mobile homepage checks before publishing both
SHA-tagged images and updating the existing apps. Recorded mode, model cap zero
and service-token authentication stay unchanged. See
[release decision](decisions/0020-main-release-and-default-experience.md) and
[latest release runs](https://github.com/alexwafula/pulse/actions/workflows/build-images.yml)
for the deployed source SHA and rollout result.

The Oct 13 record below is historical; it does not identify later main images.

## October 15 recheck

Current console ingestion and the Express-environment investigation are recorded
in [cloud readiness](CLOUD-READINESS-2026-10-15.md). The fresh marker confirms
Log Analytics works despite the CLI stream error. Network isolation and new
Foundry traces are not claimed complete. Native review is tracked separately.

Main CI and image release succeeded for `88a5b7de04c7f690b5951d140f8b59e329449890`.
Both Container Apps use that tag and report Running/Succeeded. Both health
endpoints respond; Python reports recorded mode, requires authentication and
rejects unauthenticated insight requests with 401. The model-call cap is zero.
Foundry deployment `pulse-insights` (`gpt-4.1-mini`, `2025-04-14`) is provisioned.
These read-only checks made no model calls or resource changes.

As of October 16 the localized controls/replay-library release (PR #25, main
`ce435e2d5906dc5ed86741799e2e2cd9b1a44cec`) is live: its Build Azure Images run
passed checks, build and deploy, and the served page and every static bundle
match a local build of that commit byte for byte. From the next release on, read
the exact live commit from `/version` (see [release and rollback](RELEASE.md))
instead of this file. Feature-branch pushes run CI but do not replace
production; merging to main triggers the gated release. Logs, ingress isolation, soak testing and broader live evaluations
remain open. See the [current review/checklist](PROTOTYPE-REVIEW-2026-10-15.md).

## Links

- [Pulse replay and analytics](https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/experience?scenario=late-siege&view=three)
- [Verified recorded corner insight and evidence](https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/experience?scenario=corner&view=three)
- [Image build and container smoke test](https://github.com/alexwafula/pulse/actions/runs/38463448318)
- [Full CI for the deployed image source](https://github.com/alexwafula/pulse/actions/runs/38463448290)

Initial deployment branch: `feat/meeting-readiness`. Main was not changed by that deployment.
Image source: `2cd09b9ae0164bfdb4d204e08d3889def92c7a20`.
Later deployment-helper/docs commits do not change these runtime images.

## Resources and limits

Resource group: `pulse-hackathon`; region: `southafricanorth`.

| Resource | Purpose |
|---|---|
| `crpulsealexbf7b4530` | Basic registry; admin passwords disabled |
| `env-pulse-demo` | Container Apps Consumption environment |
| `pulse-web` | Public Go HTTPS server |
| `pulse-agents` | Python recorded insights; service-token protection |
| `id-pulse-demo` | Runtime registry-pull identity |
| `id-pulse-github-build` | Registry-push identity; exact repo/branch OIDC trust |
| `id-pulse-github-deploy` | Main-only image deployment identity; app-scoped access |
| `log-pulse-demo` | Log Analytics workspace |

Both apps: 0.25 vCPU, 0.5 GiB memory, minimum zero and maximum one replica.
Cold starts are possible. ACR, logs and active hosting can consume credits;
resource-group budget alerts are notifications, not spending caps.

Python mode: `recorded`; model workflow cap: `0`; no Foundry key deployed.
The reviewed CASUAL/en-GB corner recording is matched to the complete fact-pack
request. Other supported requests fall back to deterministic templates. The
browser identifies the recording explicitly; this is not fresh live AI analysis.

| Image | Digest |
|---|---|
| `pulse-web` | `sha256:ca8865392e222338d75d621ce423cbcbbfcda0dc3104f8057927453930d327e8` |
| `pulse-agents` | `sha256:ccdce8f631e401efa62e9ce8390060fa59505837810162d1ef33c43e249f0aa2` |

## Verified on Azure

- Deployment `pulse-containerapps`: `Succeeded`; both revisions healthy.
- All five replay fixtures and both seeded metrics feeds are available.
- Go receives the recorded Python response, independently gates it and sends
  complete event/fact references; Analyst receives its checked template.
- Desktop/mobile Three.js pixels are nonblank; recorded status and evidence
  playback/return work without horizontal overflow.
- Full desktop/mobile experience regression: Three.js/PixiJS/SVG, cameras,
  Story views, charts, occupancy heatmaps, source inspection, HTMX panels,
  replay-clock synchronization, recap and failure/fallback states passed.
- Direct unauthenticated `/insights` requests return `401 Unauthorized`.
- The generated service credential was not printed, committed or placed in
  GitHub. It is injected into both Azure apps through a secure deployment parameter.

Repeat the same deployment with the current CLI account selected:

```powershell
.\scripts\deploy-azure.ps1 -ImageTag '2cd09b9ae0164bfdb4d204e08d3889def92c7a20'
```

This verifies image/build availability and rotates the service token. Model
calls stay disabled. Run `tests/integration/container-smoke.mjs` against the
public base URL afterward; set `PULSE_INSIGHT_SOURCE=python-recorded` for the
browser experience suite.

## Remaining checks

- Azure reports Python ingress `external: false`, but the endpoint was reachable
  directly even after reapplying internal ingress. Authentication is enforced
  and tested; do not claim network isolation until this discrepancy is resolved.
  Health probes intentionally remain unauthenticated. See decision 0019.
- Azure CLI console logs failed with a missing `eventStreamEndpoint` field.
  The workspace exists, but log retrieval/ingestion needs a separate check.
- An initial request during the first rollout used Go's safe template fallback;
  final ready-revision checks received the recording. A full idle/cold-start and
  sustained-load soak test is still pending, as is SSE implementation.
- Broader fact packs, live-model quality evaluations and reviewed Kiswahili
  output are not enabled by this deployment.
