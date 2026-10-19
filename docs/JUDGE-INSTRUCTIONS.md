# Pulse: judge instructions

## Open the demo

[Launch Pulse](https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=corner&view=three&locale=en-GB&persona=CASUAL).
No login, API key or installation is needed. Use a recent desktop/mobile browser.
Cold starts are possible; allow the page to finish loading. If 3D is unavailable,
select 2D or SVG. `/version` and the build label identify the deployed revision.

These instructions also apply locally at `http://127.0.0.1:8080/`.
Readiness-branch fixes are not live until the tested change is merged/deployed.

## Three-minute walkthrough

1. **Corner chance:** press Play or drag the timeline to its end. Inspect the
   explanation beside the pitch. It reports one shot after a corner, not a goal.
2. Expand **Fact check**. Inspect the fact ID, source event IDs and counts.
   **Verified (recorded)** means a stored, request-matched response passed the
   checks again; the public demo makes no fresh model calls. If Python is
   unavailable, a safe deterministic template is labelled **Template** instead.
3. Click **Evidence** to replay the corner and shot; **Return to match** restores
   your position. Switch **Analyst** to compare the same facts in another style.
4. Open **Scenarios**, choose **Late siege**, pause and seek to the end. Open
   **Control** in Live, or **Model & moments** in Insights. Click **Sustained
   pressure**: Live replays the window with its source events and metric ticks.
   On the readiness build, its explanation says **Template / Not model-verified**.
5. In **Insights**, compare **Match graphs** and **Pitch maps**: pass network,
   heatmap and shots. Choose Aurora Vale for shot locations. Clicking a shot or
   its Evidence button returns to the corresponding source action in Live.
6. Open **Story** for clock-bounded Catch up, Highlights and Player focus. At
   the sequence end, **Recap** offers a deterministic source-event summary and
   text download. Rewind: future actions disappear from those views.

## Inspector and comparison branch

These additions are local to `feat/agent-inspector-comparison` until merged/deployed.
For **corner**, seek to the end and expand **Agent Inspector** beneath the insight.
Inspect the actual source fact, delivery outcome and independent Go gate. Open
**Foundry reference run** for the separately captured Oct 19 three-role outputs,
provider response IDs, token usage and observed durations. It is a reproduction,
not a recovered trace of the original recording or fresh generation on this visit.
**Safety test** contains a deliberately wrong injected claim; Show test result
reveals the real Go rejection and checked fallback, not a model failure claim.

For **Late siege**, seek to the end, choose **Insights -> What changed?**, and
select **Aurora Vale** plus a 20-second window. Compare the earlier/recent counts,
lane destinations and source actions. Replay either window on the existing pitch;
Return to match restores the prior clock. The earlier replay stops one millisecond
before the shared boundary to exclude the recent window's first action. Individual
evidence buttons inspect their source event in Live. The comparison icon beside
a detected moment opens that team's windows ending at detection. Rewinding before
two full windows hides the comparison, not replacing missing data with invented values.

## Interpret the labels

All teams, players and sequences are fictional. No real match footage is used.
Tracking metrics are **model estimate, uncalibrated**: they are not possession,
event counts or independently established tactical truth. Heatmaps show
tracking player-time, not touches. No goal/result is recorded; unavailable is
not 0:0. Player focus is a view filter, not a new agent persona.

Alex accepted the existing native-language/Swahili review. New Inspector/comparison
technical copy has draft translations; it is not covered by that earlier review.
Translated insight requests are deterministic and never labelled model-verified.
Speech, SSE/live ingestion, broader agent wording and model-quality scores
are not part of this demo. See [provenance](RECORDING-PROVENANCE.md).

Source: [public repository](https://github.com/alexwafula/pulse).
The team must verify the submitted revision using these steps in a clean browser
and keep the working URL available throughout judging.
For the team's EAT calendar, keep it available until at least Nov 11, 2026,
11:00 AM EAT (after Nov 10, 11:59 PM Pacific). Confirm against the
[official timing/testing rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).
