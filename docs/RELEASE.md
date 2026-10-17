# Release, version and rollback

Pulse releases from `main` only. Every merge to `main` is checked, built,
smoke-tested and deployed by [`build-images.yml`](../.github/workflows/build-images.yml).
The web image carries the source commit it was built from, so the live site can
always be traced back to a commit and its pull request.

## Read the live version

```bash
curl -s https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/version
# {"sha":"<40-char commit>","shortSha":"<7 chars>","builtAt":"<UTC build time>","ref":"main"}
```

- `/version` is never redirected and is served with `Cache-Control: no-store`.
- Every response, errors included, also carries `X-Pulse-Build: <shortSha>`:
  ```bash
  curl -s -D - -o /dev/null https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/healthz | grep -i x-pulse-build
  ```
- The page footer shows `build <shortSha>` in every language.
- A local `go run`/`go build` without build flags reports `unknown` in every
  field. That is expected; only release images are stamped.
- `ref` is `github.ref_name`, so it reads `main` on release images. Releases are
  only built from `refs/heads/main` (`build-images.yml:17`, `:22`). Images built
  before this was added report `unknown`.

**How the build is stamped.** `Dockerfile` turns the build args
`PULSE_BUILD_SHA`, `PULSE_BUILD_TIME` and `PULSE_BUILD_REF` into Go `-ldflags -X`
values on `app/internal/buildinfo`. `build-images.yml` passes `$GITHUB_SHA`, the
UTC build time and `${{ github.ref_name }}` for `pulse-web` only (`:46`). The Python `pulse-agents` image is
unchanged. For a local stamped build:

```bash
P=github.com/alexwafula/pulse/app/internal/buildinfo
go build -ldflags "-X $P.SHA=$(git rev-parse HEAD) -X $P.BuiltAt=$(date -u +%Y-%m-%dT%H:%M:%SZ) -X $P.Ref=$(git symbolic-ref -q HEAD)" -o pulse ./app/cmd/server
```

## Map a SHA to its pull request

**The SHA shown on live is the merge commit on `main`, not the PR's head commit.**
Pull requests are merged with merge commits, and a release builds the head of
`main` after each merge. So `/version` reports the merge commit, whose parents
are the previous `main` and the PR head. The PR's own branch SHAs never reach
production. Look the live SHA up on `main`:

```bash
git fetch origin
git log -1 --format='%H %s' <sha>
# <sha> Merge pull request #25 from alexwafula/feat/prototype-experience-polish
```

If the SHA is not a merge commit (for example a commit that was pushed directly),
find the merge that brought it into `main`:

```bash
git log --merges --ancestry-path --reverse --format='%H %s' <sha>..origin/main | head -1
```

To list what changed since the previous release, compare it with the release
before it (find earlier release SHAs in the
[Build Azure Images run list](https://github.com/alexwafula/pulse/actions/workflows/build-images.yml)):

```bash
git log --oneline <previous-sha>..<sha>
```

## Roll back

### Primary: revert on `main` through a pull request

This is the normal path. The revert ships through the same gate as any other change.

```bash
git fetch origin
git switch -c revert/<short-sha> origin/main
git revert -m 1 <merge-sha>          # -m 1 keeps main's side of the merge
git push -u origin revert/<short-sha>
gh pr create --base main --title "Revert #<n>: <reason>" --body "Rolls back <merge-sha>. Live /version before: <sha>."
```

- Merging the revert PR triggers `build-images.yml`. It deploys only after the CI
  checks pass (see the gate below).
- After the deploy, confirm that `/version` reports the revert's merge SHA.
- To roll back several releases, revert each merge, newest first, in one PR.

### Emergency stopgap: redeploy an earlier image tag

Use this only when production must change before a revert can pass CI. It requires
`az login` with deploy rights on `pulse-hackathon`, plus PowerShell 7.

```powershell
.\scripts\deploy-azure.ps1 -ImageTag '<full 40-char sha of a previous release>'
```

The script:
1. refuses to continue unless both `CI` and `Build Azure Images` succeeded for that
   SHA and both image tags exist in `crpulsealexbf7b4530` (`scripts/deploy-azure.ps1:15-25`);
2. redeploys `infra/azure/main.bicep` in recorded mode with a model cap of 0;
3. generates a **new** Go-to-Python service token (`:27-38`).

Confirm the result with `curl -s …/version`.

> **WARNING: this is temporary.** The next push to `main` deploys the head of
> `main` again and overwrites the stopgap. A revert PR (above) must always follow,
> or the problem returns with the next merge.

## The release gate (checks → build → deploy)

All three jobs live in `.github/workflows/build-images.yml` and are chained with
`needs:`. A failure at any stage stops everything after it.

| stage | lines | what it does |
|---|---|---|
| trigger | `:3-6` | push to `main`, plus manual `workflow_dispatch` |
| `checks` | `:16-18` | calls `.github/workflows/ci.yml` (`workflow_call`, `ci.yml:4`), which runs `./scripts/check.sh` (`ci.yml:42-43`): all 10 gates |
| `build` | `:20-22` | `needs: checks`; builds both images (SHA-stamped `pulse-web`), runs them together without model calls, and requires `container-smoke.mjs` and `homepage-browser.mjs` to pass (`:63-64`) before pushing the tags |
| `deploy` | `:91-93` | `needs: build`; skips itself if `main` has moved on (`:106-112`), updates both Container Apps to the tested tag (`:127-128`), re-runs `container-smoke.mjs` against production (`:139`), then requires the live `/version` `.sha` to equal `github.sha` within 120 s, otherwise the job fails (`:143-173`) |

Each of `checks`, `build` and `deploy` also requires `github.repository == 'alexwafula/pulse'`
and `github.ref == 'refs/heads/main'` (`:17`, `:22`, `:93`). Forks and branches
never build or deploy. The OIDC subjects are recorded in
[ADR 0018](decisions/0018-passwordless-image-builds.md).
