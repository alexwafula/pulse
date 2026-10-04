# 0003: Architecture brief review

Status: recommendations for team decision, October 4, 2026.

Source: "Pulse: Architecture and Stack Decision Brief" (team draft,
October 4, 2026). This note compares that brief with the current Pulse
repository. It does not adopt every proposal in the brief.

## What aligns

The repo already follows the brief's strongest boundary: a Go-owned,
deterministic match stream with versioned JSON Schemas and examples that
Python and the browser can consume. The Go + HTMX direction also matches;
the browser pitch should be a dedicated TypeScript island outside HTMX
replacement regions. Fictional names and a single match clock are in place.

## Decisions to make next

1. Reconcile the colleague's reported TypeScript/Zod contract (10 event
   types, eight cue kinds and 45 tests) with the smaller v1 contract in this
   repo (six event types and one cue shape). That contract and its fixtures
   are not here yet. Agree on one canonical set of JSON Schemas before
   either service adds more payload types.
2. Prefer SSE for the initial one-way match and cue stream. Play, pause and
   seek can use ordinary HTTP requests. Keep the current replay message
   envelope; it does not depend on transport. Use WebSocket if a concrete
   two-way requirement appears. Test reconnect and heartbeats before Azure.
3. Add shared invalid fixtures and a Go cue gate before publishing
   generated narration. A cue needs valid timing, existing fact and event
   references, and a verification result. JSON Schema catches shape; Go
   must enforce cross-field and cross-payload rules. The current authored
   cue is only a contract example.
4. Treat the current eight-player, nine-frame sequence as an integration
   fixture. Pitch control, pressure and similar spatial metrics need a
   full-team tracking fixture at a useful sample rate (the brief suggests
   about 5 Hz), then tests on unseen seeds. Do not present the current
   sample as evidence for tactical calculations.
5. Keep three agent responsibilities for the first complete demo:
   Analyst/Explainer, Storyteller and Verifier. The brief's seven roles
   describe useful tasks, but do not require seven separately deployed
   agents. A template insight and code-based gate should work first.
6. Run small Azure and Swahili voice spikes after the local event-to-cue
   path works. The brief makes Event Hubs, Speech and Foundry important to
   the final Azure story, while also marking cost and voice availability
   as unresolved. Record measured results before committing spend or
   promising word-synced audio.

## Next integration checkpoint

Share the colleague's contract and fixtures, resolve any field differences,
then stream this replay to a browser pitch. After that, calculate a small
fact pack in Go, send it to a Python template endpoint, and display one
evidence-linked cue through the Go gate. This gives each teammate a working
boundary before adding tactical metrics and agents.
