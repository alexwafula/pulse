# Demo video

The reproducible capture uses the actual local UI with English captions, no
voice synthesis, music, real football footage or provider-console mockups.
It is a **draft pending human approval**, not an uploaded final submission.
The caption band is outside the app. The script refuses non-loopback URLs,
checks Python is in recorded mode and requires the checked corner recording.

```powershell
$env:PULSE_MODEL_REQUEST_CAP = '0'
.\scripts\start-local.ps1 -AgentMode recorded
node scripts/capture-demo.mjs
```

Only start the launcher if no local Pulse setup is already listening.
Use `PULSE_URL`, `PULSE_AGENT_URL` and `CHROME_PATH` for alternate local ports or
Chrome location. Playwright's existing recording helper must be installed;
missing FFmpeg support is a setup error, not a reason to add a new dependency.
The script records roughly 100 seconds; slower captures fail at 115 seconds.

Output: `docs/media/demo-draft/pulse-demo.webm` plus `capture.json` with the
scene captions and timings. Large video files are ignored by Git; upload the
reviewed file to a public video platform rather than growing the source repo.

Oct 18 capture: **87.40 seconds**, 1440x1000 VP8/WebM, no audio. Sample frames
were decoded and inspected for pressure, source shot positions and recorded
Fact check. This does not replace the representative's complete watch-through.

## Storyboard / narration

| Scene | What the viewer sees / point to make |
|---|---|
| Opening | Fictional 3D replay; inspectable football stories |
| Pressure | Go-detected moment, template badge, both source actions and ticks |
| Analyst | Same count and window; model estimate explicitly uncalibrated |
| Charts | Replay-derived cumulative statistics |
| Heatmap / shots | Player-time, not possession; recorded source shot positions |
| Corner | Verified (recorded), never fresh model generation |
| Fact check | Checked claim, exact fact and source event references |
| Evidence | The corner and shot replay on one match clock |
| Persona / locale | Analyst template; translation drafts honestly labelled |
| Recap | Deterministic recap, evidence and text download |
| Closing | Actual stack; Azure hosting and opt-in bounded Foundry integration |

## Publish checklist

Watch start to finish, check duration below two minutes, caption readability,
nonblank/moving pitch and correct labels. Resolve the human items in
[submission readiness](SUBMISSION-READINESS.md). Confirm the video matches the
final deployed SHA. Upload publicly or via a publicly accessible unlisted link
on an accepted platform, then test it signed out. Add the final video URL and
judge instructions to the project page; no video-platform account is connected
here, so upload is a representative action. See the
[official video requirements](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).
