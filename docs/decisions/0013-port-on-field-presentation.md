# 0013: Port the supplied on-field presentation

Date: 2026-10-12
Status: Implemented on `feat/experience-integration`; not merged into main.

## Context

The first integration ported navigation and HTML panels but retained Pulse's
capsule-and-number pitch. User feedback correctly identified that the supplied
frontend's defining visual experience was still missing.

## Decision

Port the supplied Matchlens stadium and articulated character design into typed
Three.js renderer modules, using the installed Three.js version. Bring its
striped turf, stands/crowd, kits, detailed bodies, patterned ball and close
perspective broadcast/tactical/follow cameras to `/experience`. Keep `/` using
the original renderer for comparison. PixiJS receives the corresponding turf,
kit colors and patterned ball in its tactical view.

The Go replay remains authoritative. Character roots use tracked metres; gait
uses adjacent-frame velocity and elapsed match time. Rewind reproduces poses,
pause freezes them and stationary tracking does not produce running. Avatar
appearance and crowd placement are seeded styling, not match facts. Player tags
show the source event actor only. Ball height is tracked Z, not an invented arc.
No browser-side simulator, metric, holder inference or host AI call is imported.

The control grid remains available but starts off in the preview so its tint
does not obscure the natural turf and kits. Source API, contracts, cue gate,
Python agents and main dashboard defaults are unchanged. No new dependencies.

## Verification

Pose tests cover headings, source-clock animation, stationary tracking, pause,
rewind and preserving recorded root positions. Browser tests assert the new
renderer is active, inspect desktop/mobile screenshots, check nonblank/moving
pixels, frozen/reproducible paused frames, actor tags, camera presets, optional
control overlays and the existing HTMX/evidence/recap flow.
