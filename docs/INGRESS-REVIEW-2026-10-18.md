# Python ingress follow-up

Date: 2026-10-18. Decision: **KEEP CURRENT HOSTING**, explicitly confirmed by Alex.
Private network isolation is still unresolved; application authentication works.

## Observed configuration

- Existing environment: `env-pulse-demo`, Express, South Africa North.
- Go and Python share that environment. Python reports `external: false`, HTTP
  transport, target port 8090 and `allowInsecure: false`.
- Python remains `recorded`, `PULSE_MODEL_REQUEST_CAP=0`, `PULSE_REQUIRE_AUTH=1`.
- Both CLI and stable management API `2026-07-01` report the same ingress state.
  CLI version: 2.91.0; Container Apps extension: 1.3.0b5.

## Actual requests

| Check | Result |
|---|---|
| Public Python `GET /healthz` before the update | 200; recorded mode |
| Unauthenticated Python `POST /insights` | 401; rejected before processing |
| Reapply only existing internal ingress through API `2026-07-01` | Accepted (202); resource subsequently Succeeded |
| Public Python health after the update and propagation interval | Still 200 at 2026-10-18T14:51:48Z |
| Go corner insight after the update | 200, `X-Pulse-Insight-Source: python-recorded` |

The configuration/runtime discrepancy remains. A successful control-plane update
does not establish a private boundary. Its root cause is not confirmed; this is
not a claim that Express universally lacks internal-ingress support. Current
[Microsoft Express documentation](https://learn.microsoft.com/en-us/azure/container-apps/express-overview)
lists internal/external ingress but not built-in service discovery. Do not invent
an `.internal` hostname or substitute broad IP allowlists for verified isolation.

## Agreed outcome

Keep both existing apps and URLs. Retain TLS, service-token authentication,
recorded mode and cap zero. Do not migrate, create a second environment, change
RBAC, add monitoring resources or enable model calls. No resources were created.
The existing deployment check expecting 401 remains appropriate for the current
application boundary; it must not be relabelled as a network-isolation test.

If revisited, provide these observations to Azure support or obtain approval for
a separately tested standard Consumption deployment. Acceptance must show both
an outside request rejected at the platform boundary and working Go-to-Python
delivery with complete evidence, not a masked Go fallback. Keep authentication
even after that. See [authentication decision](decisions/0019-agent-service-authentication.md).

## October 19 read-only recheck

At 2026-10-19T05:25:48Z the existing public Python health endpoint still reported
`recorded`, an unauthenticated insight request returned 401, and Go `/version`
reported main build `1a9c473`. The hosted container smoke test passed all five
scenarios, seeded metrics, recorded corner delivery, Analyst template and complete
source references. Hosting and runtime settings were not changed by this recheck.
Private ingress remains deferred, not resolved.
