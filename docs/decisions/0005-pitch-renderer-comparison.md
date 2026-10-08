# Pitch renderer comparison

Date: 2026-10-06

## Context

Alex requested a local Three.js and PixiJS comparison to improve the pitch
experience before pushing. This is a requested experience spike outside the
Phase 0 contract work, not a change to the runtime agent architecture.

## Implementation

Keep Go templates and the dedicated TypeScript island. Three.js offers an
orthographic oblique 3D view with player meshes, shadows, goals, number labels
and OrbitControls. PixiJS offers a top-down canvas view. SVG remains available
as the baseline and fallback. All use the same interpolated tracking frames,
events and elapsed match clock. There are no new football metrics or data.

An explicit renderer interface keeps presentation separate from playback.
Switching destroys the old renderer and observes host resizing. Three.js,
PixiJS and Lucide are npm dependencies; Three.js types are a dev dependency.
No remotely hosted images, models, fonts or runtime CDN scripts are required.

## Verification and trade-offs

Playwright covers desktop/mobile, animation, green pitch and both teams in
canvas pixel buffers, camera drag/reset, switching back to SVG, playback and
horizontal overflow. It also disables WebGL to test the SVG fallback.
Screenshots were inspected for framing and overlaps.

API references: [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html),
[OrbitControls](https://threejs.org/docs/pages/OrbitControls.html),
[PixiJS Graphics](https://pixijs.com/8.x/guides/components/scene-objects/graphics).

Three.js gives camera depth; PixiJS keeps the tactical picture easier to scan.
These are visual assessments, not measured performance claims. The fixture
still has eight players and sparse frames: interpolation is not a simulation
of football physics. Both libraries are bundled together for comparison and
increase download size. Select the primary view or split assets before a
production performance claim. No push or permanent renderer choice is made.
