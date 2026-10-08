# Passing network and agent shadow workflow

## Decision

Keep the first passing network inside Go metrics and server-rendered HTML.
No new dependency, graph database, agent message or shared JSON contract is
required. A future shared graph payload needs teammate approval and examples.

Go aggregates completed PASS events into directed edges weighted by evidence
count. Nodes retain the full team roster and expose sent/received totals.
Corners, crosses and incomplete passes are excluded. Each snapshot includes
only events at or before its cutoff. The browser selects snapshots using the
existing match clock; evidence buttons seek to the contributing pass.

The current sample has two passes. These are counts, not centrality scores,
tactical influence, causal explanations or evidence of a goal.

## Agent preparation

Python now has an async backend protocol and file-based prompts for Explainer,
Narrator and Verifier. `run_shadow` exercises the three stages offline with
bounded role calls, one narration retry and template fallback. Its returned
viewer response is always the existing trusted template. Model candidates
are diagnostics only; the production HTTP endpoint remains template-only.

Shadow acceptance currently requires canonical narration, validated evidence
references, all claims passing and complete verification evidence. This is
intentionally narrow. Do not mistake the fake-backend evaluation for measured
model accuracy. Foundry credentials, an approved adapter/framework dependency,
live tracing and broader deterministic semantic checks are still needed.
No credentials or paid model calls are used by these tests.

## Checks

- `go test ./...`: deterministic snapshots, weights, cutoff, team isolation,
  excluded events and HTML evidence.
- `npm run test:web`: clock/restart snapshots and clickable pass evidence,
  alongside the existing renderer and corner insight checks.
- `py -m unittest discover -s agents/tests -v`: orchestration, retry and timeout.
- `py tests/evaluations/run_agents.py`: supported and adversarial recorded
  cases, including a deliberately lenient fake verifier.
