# Agent contract alignment

Date: 2026-10-06

## Decision

The user approved migration to the Markdown conventions. Use contract 2.0.0
because camelCase, uppercase enums, regional locales and bottom-left coordinates
break v1 consumers. Migrate the fixture and renderer together to preserve visuals.

Keep the existing corner scenario and six event types. Start with COMMENTARY,
CASUAL/ANALYST and en-GB/sw-KE. Broader proposed events, personas and cue kinds
are not supported until their contracts and tests exist.

Define NarrationDraft and VerificationResult alongside FactPack now. Their
Go/Python models share authored positive and negative examples. No LLM output
may become VERIFIED merely because it matches the schema.

Use a direct HTTP Python service for the first golden path. POST /insights will
take a fact pack and explicit locale/persona options and return draft plus
verification. Decide the request envelope before endpoint implementation.
Go owns cue assembly and its final validation gate. MCP and SSE remain later
work; the current browser still fetches /api/replay.

## Consequences

Python uses standard-library TypedDict models and unittest for now. Adopting
Pydantic, an HTTP framework or Agent Framework requires agreed dependencies.
No deployment or paid calls are needed for these tests.

Contract examples remain authored, not Go-calculated or model-verified facts.
Control vs Chaos and full-team metrics remain unimplemented. This change
prepares Phase 0; it does not claim the Phase 1 exit criteria are complete.
