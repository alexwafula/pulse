# 0024: Render the pitch on demand

Date: 2026-10-18
Status: Implemented on review branch; teammate review pending

## Decision

The replay controller in `app/web/src/pitch.ts` no longer redraws the Three.js
or PixiJS pitch on every animation frame. `render()` still draws synchronously
whenever the replay clock, camera, overlay or selection changes. The animation
loop is scheduled only while playing, after a resize, after camera reset or
orbit input, and while OrbitControls damping is still easing (`draw()` returns
`true`).

Draws are deferred while `document.hidden` or while an IntersectionObserver
reports the canvas host off screen (for example the hidden watch dock). The
replay clock keeps advancing during playback with the pitch hidden, because
Story and Insights follow it; the deferred frame is drawn when the pitch is
visible again.

## Consequences

A paused pitch issues no WebGL draws, so software-GL browsers (headless test
runs, machines without a GPU) stay responsive to input. Poses depend only on
the replay clock, so on-demand drawing does not change visuals.
`tests/integration/render-loop-browser.mjs` counts frames with WebGL draw calls
for paused, playing and hidden-tab states. No dependency or contract change.
