# 0020: Main is the release branch; the experience is the homepage

## Routing

`/` serves the desired prototype-style UI, defaulting to the seeded 22-player
late-siege replay when available. `/experience` remains a compatible alias.
`/legacy` contains the original dashboard and is labelled explicitly. Explicit
scenario/renderer query parameters are preserved. APIs keep their existing
default corner fixture, and the browser always requests its selected scenario.

## Release pipeline

Main push or main-only manual dispatch runs reusable CI, then builds both images,
tests authenticated container delivery and the desktop/mobile homepage, and
uploads commit-SHA tags. Only a successful build can run the deployment job.
The deployment skips superseded main commits, updates only the two existing
images, preserves service secrets/recorded mode/hosting limits, then runs the
public smoke check. A failed check blocks release; no tests are bypassed.

The publisher trusts only the immutable main repository subject and has registry
push access. A separate main deployment identity has Container Apps Contributor
on the two apps plus Reader on their environment. Neither identity has Foundry
or subscription-wide deployment access. Infrastructure provisioning and service
token rotation remain owner-run tasks through `scripts/deploy-azure.ps1`.

## Focused reliability changes

Include the colleague's expanded reproducibility gate for all five browser
bundles. Map memory uses the selected scenario, including the query-free homepage.
Shot hit testing uses nearest points and a minimum touch target in screen pixels;
coordinates and evidence remain Go-owned. Browser tests wait for the exact shot
clock after navigation, not merely an existing clock element.
