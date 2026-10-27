# Demo video

The reproducible capture uses the actual local UI with English captions, no
voice synthesis, music, real football footage or provider-console mockups.
The caption band is rendered outside the app frame. The script refuses non-loopback URLs,
checks Python is in `recorded` mode and requires the checked corner and open-play recordings.

```powershell
$env:PULSE_MODEL_REQUEST_CAP = '0'
.\scripts\start-local.ps1 -AgentMode recorded -SkipWebBuild
node scripts/capture-demo.mjs
```

Only start the launcher if no local Pulse setup is already listening.
Use `PULSE_URL`, `PULSE_AGENT_URL` and `CHROME_PATH` for alternate local ports or
Chrome location. The script records roughly 90–100 seconds; slower captures fail at 115 seconds (well under the 2-minute official limit).

Output: `docs/media/demo-draft/pulse-demo.webm` plus `capture.json` with the
scene captions and timings. Large video files are ignored by Git; upload the
reviewed file to YouTube or Vimeo rather than committing binary video to the source repo.

## Storyboard / narration (Oct 27 refresh — 14 scenes)

| Scene | Scenario | What the viewer sees / point to make |
|---|---|---|
| 1. Opening | `end-to-end` | 3D Broadcast camera on two-sided 11v11 synthetic replay; inspectable football stories |
| 2. Read the game | `end-to-end` | Go-calculated **Shot Lens** geometry (distance & goalpost angle) and 8-second **Player Spotlight** trail |
| 3. Open-play insight | `late-siege` | `Verified (recorded)` open-play pass-count insight with **Agent Inspector** showing captured 3-role Foundry provenance |
| 4. Sustained pressure | `late-siege` | Go-detected pressure moment, `Template` badge, citing both source actions and metric ticks |
| 5. Analyst view | `late-siege` | Action count, source window, and canonical `model estimate, uncalibrated` label |
| 6. Match graphs | `late-siege` | Go-calculated cumulative pass, box-entry and shot charts synchronized with rewind |
| 7. Heatmap | `late-siege` | Sample-and-hold player-time occupancy heatmap (not touches or possession) |
| 8. What changed? | `late-siege` | Adjacent 20-second same-team window comparison with side-by-side pitch diagrams |
| 9. Corner insight | `corner` | `Verified (recorded)` set-piece insight with zero runtime model calls |
| 10. Fact check & Safety test | `corner` | **Fact check** claims/events + **Agent Inspector Safety test** rejecting an injected bad claim (`Rejected by Go gate. Safe template passed.`) |
| 11. Evidence Trail | `corner` | Clicking **Evidence** replays the exact corner-to-shot clip on the shared match clock |
| 12. Broadcast mode | `corner` | Full-viewport **Broadcast mode** with match-timed, provenance-labelled captions |
| 13. Persona & Locales | `corner` | **Analyst** template switch + **Kiswahili (`sw-KE`)** / **Hindi (`hi-IN`)** localized interface and templates |
| 14. Recap & Stack | `corner` | Deterministic sequence **Recap** with text download; Go + Python agents + HTMX + TypeScript on Azure Container Apps & Microsoft Foundry |

## Publish checklist

Watch `docs/media/demo-draft/pulse-demo.webm` start to finish, check duration below two minutes, caption readability,
nonblank/moving pitch and correct labels. Upload publicly or via a publicly accessible unlisted link
on an accepted platform (YouTube or Vimeo), then test it while signed out. Add the final video URL and
judge instructions to the project page. See the
[official video requirements](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).
