# Local core and cloud handoff

## Scope

Alex requested more of the local demo before configuring Foundry and Azure.
Keep the previously edited passing/agent work, add three authored variants,
local attacking metrics, audience controls and a recap. No new package,
shared JSON contract or paid infrastructure is introduced in this change.

The variants share fictional teams and the 60-second clock. Central entry
adds an open-play box entry and an unsuccessful shot; Passing exchange adds
a return pass. They are not unseen-seed evaluations or a general simulator.
Tracking waypoints are added at altered action starts/ends. The base fixture
and its blocked final shot are unchanged.

## Metrics

- Lanes are equal thirds of pitch width relative to attacking direction and
  count completed PASS/CARRY destinations, including those outside the final third.
- The opponent penalty area is 16.5 m deep and 40.32 m wide, centered on goal.
- Entries cross from outside to inside on a completed PASS/CARRY.
- Entry-to-shot conversion is the percentage of entries followed by a same-team,
  same-phase shot within 12 seconds, before another entry or opponent event.
- No entries yields N/A, not an invented zero conversion rate. A blocked shot
  counts as an attempt, never a goal. These are descriptive metrics, not xG.

## Publication and cloud readiness

Keep the exact canonical template gate. GOAL schema changes and enabling model
publication are waiting for human contract approval. Kiswahili is disabled
pending native review. No free-form model prose, fabricated goal or reviewed
translation is represented as complete.

The optional Foundry adapter uses standard-library REST to the Microsoft v1
model endpoint, strict JSON output shape, bounded role calls, cache and request
cap. It is shadow-only. Secrets remain Python-side and are excluded from repr,
source, frontend and media. No live calls have been made; mocked HTTP tests
cannot establish model compatibility, latency or verifier quality.

Container Apps is the intended cloud handoff: Go external ingress, Python
internal ingress in the same environment, managed-identity registry pulls and
secret references. Container definitions are not runtime-tested because Docker
and Azure CLI are absent. The Python HTTP server remains a demo adapter, not
production-grade ASGI hosting.

## Checks and media

Go unit tests cover counts, cutoffs, attribution and deterministic variants.
Python tests cover endpoint safety, mocked REST, cache/cap, rejection and retry.
Thirty recorded agent cases exercise the canonical guard, not model accuracy.
Chrome tests cover scenarios, metric rewind, audience switching, recap download,
evidence navigation and desktop/mobile layout. Gallery PNGs are real screenshots
of the local template-mode application; a final cloud/model demo video remains.
