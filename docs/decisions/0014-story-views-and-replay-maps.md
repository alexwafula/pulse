# 0014: Story views and replay-backed maps

Date: 2026-10-12
Status: Implemented on `feat/experience-integration`; not merged into main.

## Competition fit

The [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md)
were checked on this date. Section 4.1 explicitly supports narrative generation,
recaps and personalized analyst/casual/player experiences. Charts/maps are our
interpretation of its explainable-statistics objective, not an organizer approval.
Sections 3, 4.3, 4.6 and 4.11 require a team of at most four, newly created work
after registration opened September 29, and appropriate ownership/permissions.
Confirm the contributor's rights and permission before submission (for the Matchlens
prototype, confirmed on 2026-10-19; see [ADR 0015](0015-prototype-visual-system.md#fonts-and-provenance)). Sections
4.3-4.7 require a functioning, synthetic-data project and public submission repo.
Eligibility still depends on all rules; a compatible feature is not a compliant
entry by itself.

## Decision

Adapt the supplied prototype's Story and pitch-map navigation, but keep Pulse's
Go computations, single replay clock, conservative cue gate and v2 contracts.
No new dependencies, Python changes, paid calls or shared-schema changes.

- Story: Live (last five), Catch up (all elapsed), Highlights (recorded shots,
  corners and crosses), Player focus (source actor/recipient filter).
- Casual uses concise source descriptions; Analyst also displays IDs, phase and
  recorded coordinates. These deterministic source logs are not agent output.
- Player focus counts source involvements, attempted/completed passes, completed
  passes received and shot attempts. It is not a new SPOTLIGHT persona.
- Charts reuse Go's existing directed passing and attacking snapshots for
  cumulative completed passes, shot attempts and box entries. Future time is blank.
- Team tracking occupancy is duration-weighted sample-and-hold in 5 x 4 m cells,
  shown in player-seconds, not touches, possession, danger or pressing. Sparse
  fixtures are approximate; the longest included sample interval is visible.
- Shot maps use source shot origins and evidence buttons. COMPLETE is not a goal.
- Attack-relative lane counts and links to existing passing/model/route evidence
  complete the overview. Pressure/control estimates remain labelled and separate.

The pitch/cue region is never HTMX-swapped. Insights uses an unframed full-width
analysis band; Story remains beside the match. Controls and chart/map dimensions
are responsive. API selectors and contribution ownership are in
[the frontend handoff](../FRONTEND-INTEGRATION.md).

## Deferred

The prototype's xG, ratings, referee verdicts, rival narratives, roleplay interviews,
AI booth, pressure-event heatmap, host-specific storage/AI calls and social features
are not ported. Pulse lacks their data/contracts or production agent integration.
Model narratives still require the agreed fact packs, Verifier and Go cue gate.
English only; reviewed Kiswahili and agent persona additions remain separate work.

## Checks

Go tests cover duration weighting, edge coordinates, selector validation, cell
conservation, no future positions/events, source counts, Y inversion and rewind.
Real Chrome desktop/mobile checks cover Story modes, persona detail, maps/charts,
shot evidence, local assets, API failure/retry and pitch identity. The original
dashboard retains its separate regression checks. No Azure deployment or live
model quality is claimed by this preview.
