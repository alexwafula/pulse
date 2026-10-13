# Uploadable media

These are screenshots of the actual local application, using fictional data.
They show template insights, not live model-generated or real-match footage.

| File | Suggested use | Caption |
| --- | --- | --- |
| pulse-overview.png | Project cover | Pulse's fictional match replay, tactical metrics and Analyst template insight. |
| pulse-analytics.png | Gallery | A directed passing network with Go-calculated counts and inspectable event evidence. |
| pulse-tactics.png | Gallery | Attacking-lane counts, box entries and entry-to-shot conversion for the fictional central-entry sequence. |
| pulse-evidence.png | Gallery | Replay the corner and shot cited by the insight, on the shared match clock. |
| pulse-recap.png | Gallery | A deterministic sequence recap with event evidence and text download. |

Regenerate after changing the UI:

```powershell
$env:PULSE_URL = 'http://127.0.0.1:8083'
node tests/integration/capture-media.mjs
```

The final submission also needs a short public demo video. These PNGs are
registration/gallery assets, not a substitute for that video. See the outline
in `docs/PROJECT-PAGE.md`; record actual Foundry/Azure behavior only after it
has been configured and tested.

## Experience preview

Current prototype-style branch screenshots, captured by the real browser tests
on 2026-10-13. These also use fictional replay data, not live model output.

| File | View |
| --- | --- |
| pulse-experience-live.png | Stadium, articulated players, replay toolbar and event timeline. |
| pulse-experience-graphs.png | Go-backed cumulative completed passes, shot attempts and box entries. |
| pulse-experience-heatmap.png | Relative soft shading of recorded player-time with source cell totals. |
| pulse-experience-mobile-network.png | Mobile passing map, recorded pass-involvement positions and source evidence. |

Run `npm run test:experience` with `PULSE_URL` set to a running Go server to
capture new screenshots in the temporary `pulse-experience-preview` directory.
Preview setup and contributor APIs: [frontend handoff](../FRONTEND-INTEGRATION.md).
