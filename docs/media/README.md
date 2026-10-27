# Uploadable media

Oct 27: an updated captioned local demo capture (**92.04 seconds**, 1440x1000 VP8/WebM) is available at
`demo-draft/pulse-demo.webm`, with a local `demo-draft/index.html` player.
The video is ignored by Git and ready for public upload; regenerate
with `node scripts/capture-demo.mjs`. See [publish checklist](../DEMO-VIDEO.md).

These are screenshots of the actual local application on `main` (`aed03f9`), using fictional data
and `recorded` / `template` agent modes with zero runtime model calls.

## Top 4 Screenshots Recommended for the Hackathon Portal (alongside Demo Video)

| File | Suggested Portal Slot | Caption |
| --- | --- | --- |
| `pulse-experience-live.png` | **1. Cover / Hero** | Two-sided 11v11 synthetic replay (`end-to-end`) in the 3D Broadcast camera with procedural footwork and live match metrics. |
| `pulse-inspector.png` | **2. Agent Inspector & Safety Test** | `Verified (recorded)` insight with Fact check, captured 3-role Microsoft Foundry (`gpt-4.1-mini`) provenance, and the Go cue gate rejecting an injected bad claim. |
| `pulse-shot-lens-spotlight.png` | **3. Read the Game: Shot Lens & Spotlight** | Go-calculated Shot Lens geometry (distance and goalpost angle) and an 8-second Player Spotlight movement trail. |
| `pulse-what-changed.png` | **4. Insights: What Changed? Comparison** | Adjacent 20-second same-team source-event windows with side-by-side pitch diagrams and bounded window replay. |

## Additional Gallery Screenshots in `docs/media/`

| File | View |
| --- | --- |
| `pulse-overview.png` | Full Live workspace with `Verified (recorded)` corner insight, Fact check and Agent Inspector expanded. |
| `pulse-broadcast.png` | Fullscreen Broadcast mode with match-timed, provenance-labelled captions over the 3D pitch. |
| `pulse-evidence.png` | Evidence Trail replaying the exact corner-to-shot actions beneath the 3D pitch on the shared match clock. |
| `pulse-experience-graphs.png` | Insights: Go-backed cumulative completed passes, shot attempts and penalty-area entries. |
| `pulse-experience-heatmap.png` | Insights: Pitch maps showing sample-and-hold player-time occupancy heatmap with cell inspection. |
| `pulse-experience-mobile-network.png` | Mobile (390x844) passing map with Go-calculated pass-involvement positions. |
| `pulse-analytics.png` | Drawer passing network with directed links and completed-pass counts. |
| `pulse-tactics.png` | Attacking-lane progression, penalty-area entries and entry-to-shot conversion. |
| `pulse-recap.png` | Deterministic sequence recap with clickable source-event evidence and text download. |

Regenerate all screenshots against a running local recorded server:

```powershell
$srv = .\scripts\start-local.ps1 -AgentMode recorded -SkipWebBuild
$env:PULSE_URL = $srv.Pulse.TrimEnd('/')
node tests/integration/capture-media.mjs
```
