# 0015: Port the prototype visual system across working screens

Date: 2026-10-13
Status: Implemented on `feat/experience-integration`; not merged into main.
Amended: 2026-10-19 (prototype provenance confirmed; see "Fonts and provenance").

## Context

Alex requested the supplied prototype's visual treatment across all features,
not only equivalent data views. The existing preview retained too much of the
original dashboard's pitch-first layout and used cell-based SVG maps.

## Decision

- Use the prototype's neutral background, blue navigation, red/blue team accents,
  display/body typography and segmented screen navigation on `/experience`.
  Keep sections unframed and repeated metrics/event items as compact surfaces.
- Apply this to Live, Story, Insights, Recap, player focus, timelines, passing,
  routes, model values and evidence. The original `/` dashboard remains separate.
- Story/Insights/Recap are dedicated screens. Move the existing pitch into an
  optional watch dock and its existing transport into a shared toolbar. Returning
  Live restores the same DOM nodes and renderer. Never resimulate or start a clock.
- Adapt the prototype's striped canvas pitch, player-number circles, relative
  radial heat shading and area/line chart presentation. Canvas paints Go paths,
  durations, source shot coordinates and passing-map nodes; it computes no stats.
- Passing-map positions are Go averages of elapsed completed-pass involvement
  coordinates. Edges are directed and retain event evidence. Names/counts are
  metadata/source values, not the prototype's separate match engine.
- Heat shading is a display approximation of the Go sample-and-hold cells, not
  a new threat or pressing metric. Source cell duration, peak, total and sample
  interval remain explicit. Tooltips inspect the underlying bin or source action.
- Rebuild chart/map canvases after HTMX swaps, disposing observers. Repaint for
  resize/fonts, not on another animation timer. Unsupported 2D canvas leaves Go
  SVG and evidence controls working; its heatmap does not claim smoothing.

No dependencies, shared-contract changes, Python edits, live models or paid
services. No gate changes. The UI port does not implement the supplied prototype's
host-specific AI booth, social storage, predictions, roleplay/referee narratives,
ratings, xG, fantasy or betting flows. Existing data/agent limits still apply.

## Fonts and provenance

Original fonts are downloaded unmodified and served locally, with each OFL file:
[Outfit](https://github.com/google/fonts/tree/main/ofl/outfit) and
[Plus Jakarta Sans](https://github.com/google/fonts/tree/main/ofl/plusjakartasans).
No Google Fonts/CDN requests occur at runtime. The supplied HTML remains outside
the repo and its simulator/host integrations are not copied. ~~Contributor reuse
permissions still need confirming before submission, as recorded in ADR 0014.~~

This ADR is the provenance record for the prototype:

- **Who:** Ved, a registered Pulse team member, made the Matchlens prototype.
- **Tool:** claude.ai.
- **Scope:** Ved permits the team to derive the Pulse UI from the prototype, code and markup included.
- **Date:** confirmed on 2026-10-19.
- **Evidence:** the team holds Ved's written confirmation outside the repo. `docs/SUBMISSION-READINESS.md` records it.

## Checks

Go tests check means, clock cutoffs, team filtering, deterministic edge order,
evidence conservation and existing metrics/contracts. Browser checks cover desktop
and real mobile viewports, canvas pixels, pause/rewind, direct screen links, watch
dock identity, map/shot evidence, SVG fallback, local assets and API recovery.
The original dashboard suites guard the separate comparison route.
