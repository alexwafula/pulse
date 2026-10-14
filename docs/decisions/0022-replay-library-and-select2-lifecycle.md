# 0022: Replay library and settled dropdown enhancement

Date: 2026-10-15
Status: Implemented on review branch; teammate review pending

## Decision

Reuse the supplied prototype's archive thumbnail/search/filter presentation for
available Pulse scenarios. Go serves `GET /scenarios` as an HTML fragment from
its fixture catalog. Thumbnails use recorded first-frame positions. HTMX loads
a native dialog; the existing pitch/controller are not recreated by opening it.

Hide the homepage's old selector and show one Scenarios launcher. Keep the
selector in the DOM for its existing controller and visible on `/legacy`.
Guided demo uses the same cue gate/evidence path and opens Recap on completion.

Enhance dynamic selects on `htmx:afterSettle`. HTMX class/style settling otherwise
removes Select2's native hiding class after initialization. Destroy real
instances before cleanup; synchronize map selections with a presentation DOM
event rather than an extra data refresh.

Fact check displays existing verification metadata, not a new verifier.
Template/recorded statuses remain distinct. This presentation change requires
no event, fact-pack or publication-policy contract changes.

## Consequences

No new dependency/cloud service in this change. Select2/jQuery and locale support
are included from previous user-approved work (ADR 0021). Scenario metadata is
not an agent fact pack; no goals/archive results are inferred. The inaccessible
new artifact still needs an updated export; see the dated prototype review.

Unit tests bind previews to replay data. Browser tests cover focus, responsive
bounds, retry, filtering, guided replay, provenance and native hiding after
repeated HTMX swaps.
