# 0035: Replay footwork and camera composition

Status: Reviewed locally; approved for merge to main. Azure rollout follows main CI.
Date: 2026-10-23

Alex approved implementation after the pitch realism research and explicitly
requested the existing scenario branch. On 2026-10-26 Alex reviewed the local
camera and pass-stat follow-up and requested merging PR #49 to build the demo.

## Decision

Keep the fictional procedural characters and improve the animation layer without
adding assets, dependencies or a second simulation. The source recordings remain
authoritative. Full motion capture and a new football simulation are outside this
iteration.

- Human-scale avatars replace the previous 1.9x enlargement. The ball radius is
  0.11 m; a small ground locator helps visibility. Player contact shadows anchor
  the silhouettes, and selected-player labels use the corrected height.
- A precomputed replay cache provides monotone Hermite interpolation and analytic
  velocity. It passes through every recorded player position without coordinate
  overshoot. Heading changes are limited to 3.2 radians/second in source time.
  The legacy page retains its linear positions.
- Gait phase integrates recorded travel divided by a speed-dependent stride.
  Walk/run stance duration, foot clearance, arms and torso respond to speed.
  Two-bone leg articulation and counter-rotating ankles aim stance soles at the
  turf; turns can use lateral steps. Root positions never move for an animation.
- Non-carry source events cue wind-up/contact/follow-through. Completed passes
  can cue a first touch only when a subsequent recorded ball sample reaches the
  named recipient within 1.8 m and below 0.5 m. No goals, saves or successful
  outcomes are inferred. These cues are visual poses, not new football events.
- Broadcast pans and adjusts distance around the ball and nearby player cluster.
  Follow uses a closer elevated angle with context. Both use a causal low-pass
  focus baked from the source samples; neither relies on previous browser frames.
  Tactical uses a fixed orthographic full-pitch projection.
- Manual orbit remains available. Reset restores automatic framing and zoom.
  All automatic poses and camera samples are pure functions of replay time;
  paused and hidden scenes keep the existing draw-on-demand behaviour.

## Limits

These are procedural approximations, not motion-captured football. Foot planting
is an IK target rather than a physics constraint. The existing scripted routes,
carry ball placement, 5 Hz detail and sparse older recordings still limit realism.
Ball tracking and source actions remain unchanged. No fixture, shared schema,
agent model, metric, gate, dependency, CI or Azure resource changed.

## Validation

replay-motion.mjs checks all four stored fixtures: exact keyframes, bounded
positions, continuous boundary velocities, finite results, turn limits,
event-backed kicks, seek-independent camera/poses and source immutability.
character-poses.mjs retains pause/rewind, heading and stationary checks and adds
distance-driven gait, grounded stance and distinct kick/receive articulation.
motion-browser.mjs checks Broadcast/Tactical/Follow at 1440 and 390 px across the
full End to end replay, ball framing, exact camera rewind, frozen paused pixels
manual orbit/zoom reset and overflow. Screenshots are reviewed for framing.

Local checks passed: TypeScript check/build, Go tests/vet, motion and character
invariants, the 3-camera desktop/mobile sweep, and the existing experience,
match-lab, analytics and render-loop browser suites. The render-loop check measured
zero paused/hidden draws and 73 3D frames during its 1.5-second active sample on
this Windows machine. This short sample is not a hardware-independent benchmark.
Recorded agent mode was verified; no paid calls or cloud deployment were used.

## Motion follow-up (2026-10-26)

Keep the same source-driven model while giving the procedural actors more visible
weight and response. The replay cache now exposes analytic acceleration from the
existing Hermite paths; the body uses it for bounded forward lean and lateral
balance. Replay-clock breathing, low-amplitude idle sway, step bounce, arm flex
and toe-off add life without changing a player's tracked root position. Kick
poses select a foot from the ball's side when the source direction supports it,
and the extension peaks at the recorded event timestamp. The recording, event
data, scenario routes and metrics remain unchanged.

For the motion follow-up, `npm run check:web` and `npm run build:web` passed.

## Broadcast framing follow-up (2026-10-26)

Comparison with the live 3D view showed that the local Broadcast camera held too
much field around the active play. Keep the same replay-derived focus, but bring
the camera closer and lower it, with a modest lengthwise angle. Track the focus
across the pitch width at 84% with a 25 m clamp. Map the existing smoothed spread
estimate to a 33.5-36.5 m field offset and 22-24.5 m height, and use a 45-degree
lens. This is about 16% closer at the busiest reference moment; the framing eases
wider as more players gather. Follow and Tactical keep their current camera poses.

`npm run check:web` and `npm run build:web` passed after this camera adjustment.
The local preview was reviewed. The browser sweep keeps the ball in frame at 21
points in all six scenarios at desktop and mobile widths; the main release remains
pending.


## Research references

- Snapshot interpolation: https://gafferongames.com/post/snapshot_interpolation/
- Camera composition principles: https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachinePositionComposer.html
- Ball dimensions: https://www.theifab.com/laws/latest/the-ball/
- Future rigged-animation path: https://threejs.org/manual/pages/animation-system.html
