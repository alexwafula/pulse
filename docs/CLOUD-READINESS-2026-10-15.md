# Cloud readiness and teammate handoff

Date: October 15, 2026 (Africa/Nairobi)

## Verified

- Both existing apps run the successful main release; Python uses `recorded`
  mode with model workflow cap zero and service-token authentication.
- Log Analytics is receiving `ContainerAppConsoleLogs_CL` entries for both
  `pulse-web` and `pulse-agents`. A fresh harmless Python 404 marker was found
  at `2026-10-14T21:46:24.236Z`, confirming current ingestion.
- Direct Log Analytics REST queries work with the signed-in Azure account.
  The older CLI log-stream command raises `KeyError: eventStreamEndpoint`;
  this does not mean console-log ingestion is broken.
- The environment reports `environmentMode: Express`. Environment HTTP route
  configuration is unsupported there. The inspected route-list operation
  returned `ExpressEnvironmentResourceNotSupported`, not an empty route list.
- Foundry resource/project/model are provisioned. This is not evidence of new
  live model calls, quality scores or native-speaker sign-off.

## Internal ingress remains unresolved

Reapplying `--type internal --transport http --allow-insecure false` preserved
the intended configuration, but the public Python hostname still served health
and rejected unauthenticated insights at the **application** boundary (401).
An invented `.internal` hostname did not resolve; it is not a valid fix.
Latest API inspection also reported `external: false` with the public hostname.

Do not describe this as proven network isolation. Keep service authentication.
The next investigation is the current Express ingress/CLI path or an explicitly
approved standard-environment migration. Do not delete/recreate production or
rerun the full infrastructure deployment just to force an environment-mode change.

## Soak verification

`tests/integration/cloud-soak.mjs` exercises the public Go health endpoint,
seeded metrics and both deterministic native-language Python templates. It checks
complete fact/event references and requires `python-template`, not a masked Go
fallback. It makes no English/live-model requests, changes no scaling settings,
and does not claim SSE or live-agent latency coverage.

```powershell
$env:PULSE_URL = 'https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io'
$env:PULSE_SOAK_SECONDS = '900'
$env:PULSE_SOAK_INTERVAL_SECONDS = '30'
node tests/integration/cloud-soak.mjs
```

Run only after the localized Go/Python images are released. The old main rejects
these locale requests. A two-second local harness check is not a fifteen-minute
Azure soak. The actual run writes a JSON report to the temporary directory and
prints elapsed time, sample counts, failures and measured p50/p95/max latency.
Attach the results to the release PR without publishing secrets or full logs.
Preflight failures stop the script; nonzero steady-state failures fail the run.

## Historical measured results, added Oct 18

The [Oct 15 release handoff](https://github.com/alexwafula/pulse/pull/25#issuecomment-6187087966)
records a completed run against **`ce435e2`**, not this readiness branch or a
fresh test of today's deployment: 904.27 seconds, 28 rounds, 112 steady-state
requests, zero failures. Aggregate client latency was p50 1,109 ms, p95 1,229 ms,
max 1,367 ms. An earlier interrupted/failed attempt remains a separate result.

One deterministic Kiswahili request took 4,625 ms after Python had zero replicas,
through already-warm Go. This includes client latency; it is not a full-stack
cold-start or live-model benchmark. Logs from both services were observed.
These results cover HTTP/template reliability, not SSE, fresh AI quality or
current-branch production performance. SSE and ingress isolation remain open.

## Approval-gated work

- New Application Insights/Foundry tracing resources and telemetry dependencies.
  The monitoring workspace already exists, but this session has not created an
  Application Insights resource or connected it to the Foundry project.
- Up to twelve paid model calls for a small evaluation, including negative
  evidence/number cases. Public production mode must be chosen explicitly.
  In-process workflow caps reset on restart; they are not Azure spending caps.
- Deployment-check updates if public agent ingress becomes properly private.
  The current release's negative check expects 401 and must be updated honestly,
  not removed or weakened to accept arbitrary errors.
- Real native-speaker review: [locale checklist](LOCALE-REVIEW.md). Tests confirm
  parity and evidence, not translation quality. Native model publication stays off.

No paid model calls, new monitoring resources, broad RBAC roles or runtime mode
changes are authorized by the diagnostic evidence above. Record explicit approval
and actual outcomes before marking any of these items complete.

Microsoft references: [Express capabilities](https://learn.microsoft.com/en-us/azure/container-apps/express-overview),
[Log Analytics queries](https://learn.microsoft.com/en-us/azure/container-apps/log-monitoring),
[Foundry trace data and cost considerations](https://learn.microsoft.com/en-us/azure/foundry/observability/concepts/trace-data).
