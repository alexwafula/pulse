# 0019: Authenticate Go-to-Python requests independently of ingress

## Observation

Azure reported `external: false` for Python, but direct requests from the
development machine reached `/healthz` and `/insights`. Reapplying internal ingress
did not change that result. Do not treat the reported ingress flag as proof of a
private network boundary; the cause remains an Azure networking investigation.

## Decision

Protect `/insights` with a 256-bit random service token. Go sends it in the
Authorization header; Python compares it in constant time before decoding or
processing the request. Rejected requests drain at most 64 KiB with a five-second
socket deadline so the HTTP rejection can complete without a TCP reset.
Health probes remain unauthenticated. Azure's `agentAuthToken`
secure parameter becomes an app secret in both services, not a GitHub secret or
browser value. No model key is deployed in recorded mode.

The hosted Python configuration sets `PULSE_REQUIRE_AUTH=1` and fails startup
without a valid token. Local template mode may omit authentication. Wrong or
missing authorization returns 401 without running an agent. The Docker smoke
test checks that rejection and successful Go-to-Python delivery before upload.

If public Python health is reachable, that is not a privacy guarantee or a failed
insights-auth check: health returns only service status/mode. Verify `/insights`
rejects untrusted requests and Go still receives its approved recording. Continue
to configure internal ingress and investigate the discrepancy separately.
