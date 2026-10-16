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

Pulse uses GitHub's ID-bearing subject format. The exact approved subject is
`repo:alexwafula@91899603/pulse@1404538837:ref:refs/heads/feat/meeting-readiness`.
These IDs were checked against the repository API and the first job's token
metadata. Do not substitute the legacy name-only subject or add a wildcard.
See [GitHub's immutable subject reference](https://docs.github.com/en/actions/reference/security/oidc).

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

## Update: subjects now target `main` (Oct 14, ADR 0020)

The subject above is historical. Since `3eade0a` (PR #24) both federated
credentials trust `main` only, and the workflow can mint a token only for it:

- Build identity, `infra/azure/github-build.bicep:24-26` and `:44`: `branch` allows
  and defaults to `'main'`, giving
  `repo:alexwafula@91899603/pulse@1404538837:ref:refs/heads/main`
  (credential `github-main`, formerly `github-meeting-readiness`).
- Deploy identity, `infra/azure/github-deploy.bicep:15`:
  `subject: 'repo:alexwafula@91899603/pulse@1404538837:ref:refs/heads/main'`.
- Workflow, `.github/workflows/build-images.yml:3-6`: the triggers are
  `push: branches: ['main']` and `workflow_dispatch`. Every job that requests a
  token checks `github.ref == 'refs/heads/main'` (`:17`, `:22`, `:93`).

These lines describe the repository. The credentials configured in Azure were not
re-read for this note. Release and rollback steps are in
[RELEASE.md](../RELEASE.md).
