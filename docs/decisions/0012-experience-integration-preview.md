# 0012: Adapt the teammate's experience without a second engine

Date: 2026-10-12
Status: Implemented on `feat/experience-integration`; team review before merge.

## Context

The supplied Matchlens HTML demonstrates useful Live/Story/Insights navigation,
camera presets and a persistent pitch. It also embeds a different browser-side
simulator, metrics and host-specific AI/storage calls. Those data paths cannot
replace Pulse's deterministic Go engine, shared contracts or cue gate.

## Decision

- Keep `/` as the existing dashboard; add `/experience` as a comparison route.
- Use the same Go page template, TypeScript replay controller and renderer
  bundles. Do not copy the entire supplied file or its engine into this repo.
- Bundle pinned `htmx.org` 2.0.11 locally. No runtime CDN or remote fonts.
- HTMX swaps only `#experience-content`, never the pitch, playback controls,
  analytics inspector or gated insight region.
- `/experience/panel` returns escaped, server-rendered Story/Recap HTML bounded
  by a validated `atMs`. Story shows five recent source actions, not AI output.
  Recap stays unavailable until the replay's end and cites source events.
- A small documented DOM-event bridge handles the clock, event inspection and
  pane selection. Existing JSON APIs remain the independent frontend boundary.
- Broadcast/Tactical/Follow ball cameras use the existing Three.js scene and
  recorded ball coordinates. PixiJS remains tactical 2D; SVG remains fallback.
- No shared contract, agent, CI workflow or cloud resource changes. No mock
  scores, unsupported goals, social host dependencies or wagering functionality.

## Consequences

Experience contributors can improve templates/styles or build an API consumer
without changing domain logic. The shared template prevents the comparison
route from drifting away from evidence and metrics fixes. New UI styles are
route-scoped. The preview needs no Node process at runtime: bundles are committed.

This is an offline replay interface, not live SSE delivery or completed model
agents. Metrics remain uncalibrated, formation-sensitive estimates. Teammates
must review the design and source attribution before adopting it as the main UI.

## Verification

Go tests cover panel bounds, future-event exclusion, method/view validation,
escaping and shot-versus-goal wording. Browser tests cover desktop and actual
mobile viewports, all renderers, camera pixel checks, HTMX canvas persistence,
rewind, evidence, recap download, template personas and panel failure recovery.
