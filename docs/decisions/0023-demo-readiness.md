# 0023: Evidence-backed pressure templates and stable presentation

Date: 2026-10-18
Status: Implemented locally on `fix/demo-readiness`; not yet deployed

## Decision

Render a deterministic sustained-pressure explanation from the existing Go
moment API. Copy the action count, final-third control estimate, source event
IDs and metric timestamps. Validate the source actions before displaying text.
Clip the displayed evidence window to the available replay, without changing
the detector's output or inferring earlier tracking. Casual hides the numeric
model estimate; Analyst includes it unchanged.

This is a presentation template, not a new COMMENTARY cue or agent fact pack.
Show Template, Not model-verified, and the canonical model-estimate label.
Evidence includes both source actions and tracking ticks. Contract v2, Python
publication rules, Go's cue gate and recorded public mode remain unchanged.

Moment selection explicitly requests Live plus its evidence inspector. Persona
and locale changes preserve detector clips; audience-bound agent cue clips are
cleared on audience changes. Reuse the mounted pitch and sole replay clock.

Canvas charts/maps retain their source SVG until a successful paint. Coalesce
resize/font callbacks, change bitmap dimensions only when necessary, and restore
the SVG on context loss. Dispose observers and pending paints after HTMX swaps.

Static assets use gzip where smaller, representation-specific ETags and
conditional GET/HEAD. Unfingerprinted URLs must revalidate across deployments:
`Cache-Control: public, max-age=0, must-revalidate`, never immutable. Cache asset
bytes in process by path/size/modification time. Errors are not cached.

## Verification and limits

Focused browser tests inspect actual shot pixels, resize and context recovery at
desktop/mobile sizes, source IDs/ticks, pressure expiry and Live navigation.
Pure tests reject inconsistent pressure evidence. HTTP tests cover gzip, HEAD,
304, ranges, mutation and missing assets. No new dependency or paid service.

Translations are drafts. Native approval, original recording-provider evidence,
prototype contributor permission and public video upload require real humans;
automated checks and locally captured media cannot certify those items.
