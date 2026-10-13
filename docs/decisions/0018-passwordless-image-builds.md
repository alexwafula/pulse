# 0018: GitHub builds with registry-scoped Azure federation

## Decision

This Azure Students subscription rejects ACR Tasks (`TasksOperationsNotAllowed`).
Build both Dockerfiles on GitHub's hosted runner, smoke-test the containers together
in recorded mode, then push commit-SHA tags to the existing Azure registry.

`infra/azure/github-build.bicep` creates a dedicated user-assigned identity. Its
only assigned role is `AcrPush` on this registry. The federated credential trusts
only `alexwafula/pulse` and `refs/heads/feat/meeting-readiness`; forks and other
branches do not match. This identity cannot deploy Container Apps or access
Foundry. Runtime apps use a separate `AcrPull` identity.

GitHub secrets contain only client/tenant/subscription identifiers, not passwords
or model keys. Login exchanges the job's short-lived OIDC token for an Azure token.
Keep registry admin authentication disabled.

## Trigger and deployment

GitHub requires a dispatch workflow on the default branch before it can be run
manually. The initial build therefore runs on this approved branch's push, with
path filters for container/runtime files. Main is not changed or merged. The
dispatch trigger becomes usable after the workflow is reviewed into main; the
branch restriction still applies. Docs-only pushes do not rebuild images.

App deployment is a separate, explicitly approved Bicep operation by the project
owner. Check both uploaded tags and CI before deployment, then verify public Go
health, internal Python delivery, rendered pitch and source evidence.
