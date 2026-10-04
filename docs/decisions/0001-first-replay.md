# 0001: First replay and contract boundary

Status: accepted for the first local milestone.

The team-plan PDF is a draft. This milestone follows the agreed Go and HTMX
direction and keeps the facts-first model: Go owns match data and replay;
future Python agents receive a versioned fact pack and return an overlay cue.
The first fixture is authored, fictional and deliberately short. It does not
claim to be a realistic full-match generator or a calculated tactical result.

The replay command emits newline-delimited JSON messages using the same
match, event and tracking types that the later WebSocket will send. Match
metadata comes first. Tracking frames and events use one match clock; when
timestamps match, the frame comes before the event.
No database, Azure service or model call is needed to replay the sample.

Next: expose these messages over a Go WebSocket and render an HTMX-hosted
pitch. Then calculate facts in Go and send fact packs to the Python endpoint.
Control vs Chaos remains experimental until its components are defined and
tested on additional scenarios.
