# Pulse: judge instructions

## Open the demo

- **Launch Pulse (Corner Chance — Verified Recorded Insight & Agent Inspector):**
  [https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=corner&view=three&locale=en-GB&persona=CASUAL](https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=corner&view=three&locale=en-GB&persona=CASUAL)
- **Launch Pulse (End to End — 90s Two-Sided 11v11, Shot Lens & Player Spotlight):**
  [https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=end-to-end&view=three](https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=end-to-end&view=three)
- **Launch Pulse (Late Siege — 11v11 Open-Play Insight, Sustained Pressure & What Changed?):**
  [https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=late-siege&view=three](https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=late-siege&view=three)

No login, API key or installation is needed. Use a recent desktop or mobile browser.
Cold starts are possible; allow the page to finish loading. If 3D is unavailable,
select **2D** or **SVG**. `/version` and the footer build label identify the deployed revision.
These instructions also apply locally at `http://127.0.0.1:8080/`.

---

## Three-minute judge walkthrough

### 1. End to End (Two-Sided 11v11, Cameras, Shot Lens & Player Spotlight)
1. Open **Scenarios** (`Clapperboard` button in the header) and choose **End to end (11v11)**.
2. Expand **Match briefing** above the pitch for the spoiler-free setup, then press **Play** (or switch camera modes between **Broadcast**, **Tactical**, and **Follow ball**).
3. Click any **Shot** event in the right-hand **Timeline** (or seek past a shot) and scroll below the pitch to **Read the game**:
   - **Shot lens** displays the exact distance to the opposing goal centre, the visible angle between the 7.32 m goalposts, and a tactical SVG inset. Click **Replay this shot** to watch the bounded action clip.
   - Check **Player Spotlight** and pick a player to highlight them on the pitch with an 8-second recorded movement trail, cumulative pass completion, and clickable source-event chips.

### 2. Corner Chance (Verified Recorded Insight, Fact Check, Agent Inspector & Safety Test)
1. Open **Scenarios -> Corner chance**, pause, and drag the timeline scrubber to the end (`28:00`).
2. Inspect the **Match insight** card beside the pitch (`The corner produced 1 shot.`). It carries the **`Verified (recorded)`** badge.
3. Expand **Fact check** to inspect the computed fact ID (`fact-corner-...`), claim counts, and source event IDs (`evt-06`, `evt-07`).
4. Expand **Agent Inspector** beneath Fact check:
   - View the 5-step pipeline verification summary and Go gate check.
   - Expand **Foundry reference run** to inspect the three captured `gpt-4.1-mini` role outputs (**Explainer**, **Narrator**, **Verifier**), provider completion IDs, token usage, and latency.
   - Expand **Safety test** and click **Show test result**: Go injects a fabricated claim (`The corner produced 2 shots.`), rejects it at the deterministic cue gate, and proves the safe template fallback passes.
5. Click **Evidence** on the insight card to replay the exact corner-to-shot window at 1x with the Evidence Trail beneath the pitch, then click **Return to match**.

### 3. Late Siege (Open-Play Pass-Count Insight, Sustained Pressure, What Changed? & Broadcast Mode)
1. Open **Scenarios -> Late siege (11v11)**, pause, and drag the scrubber to the end (`89:20`).
2. In **English / Casual**, inspect the **Open-play pass-count insight** (`1 completed pass came before the first shot in this open-play window.`). Expand **Agent Inspector -> Captured agent run** to see the original 3-role Foundry capture for `evt-25`, `evt-26`, `evt-27`.
3. In the right drawer, click **Control** and select **Sustained pressure**: Live replays the detected pressure window citing both source events and metric ticks, explicitly labelled **`Template / Not model-verified`**. Switch to **Analyst** in the header to see action counts and the canonical **`model estimate, uncalibrated`** label.
4. Click **Insights** in the top navigation bar:
   - Compare **Match graphs** (cumulative passes, box entries, shots) and **Pitch maps** (pass network, player-time occupancy heatmap, and evidenced shot locations).
   - Click **What changed?** and select **20 seconds**: compare adjacent earlier vs. recent 20-second windows for Aurora Vale with side-by-side pitch diagrams and **Replay window** buttons.
5. Click the **Copy evidence link** icon (`Copy` button in the header) while paused on any evidence clip or timestamp, or click **Broadcast mode** (`Presentation` icon) to expand the pitch fullscreen with match-timed, provenance-labelled captions (`Escape` exits).
6. Switch **Language** (`English`, `Kiswahili`, `Hindi`) to see localized interface copy and deterministic templates, then open **Recap** to view and download the source-event match summary.

---

## Label meanings & honest boundaries

- **Synthetic & fictional only:** All clubs (*Aurora Vale*, *Bastion City*, etc.), players, and match sequences are fictional. No real match footage or Premier League marks are used.
- **`Verified (recorded)` vs `Template`:** Public Azure hosting runs with a model request cap of `0` (`recorded` mode) so judges never hit rate limits or quota errors. `Verified (recorded)` means a stored Microsoft Foundry `gpt-4.1-mini` output was matched to the complete request and passed both Python and Go verification gates. Unmatched or translated requests use deterministic `Template` fallbacks.
- **`model estimate, uncalibrated`:** Tracking-derived pitch control, pressing intensity, tactical entropy, and Control vs Chaos values are uncalibrated mathematical heuristics, not calibrated probabilities or possession shares. Heatmaps show sample-and-hold player-time, not touches.
- **Unavailable score:** Fixtures record tactical sequences without a full-match scoreline; the header states `Score unavailable` rather than implying `0:0`.

Source repository: [https://github.com/alexwafula/pulse](https://github.com/alexwafula/pulse).
Keep the deployment funded and available through at least **Nov 11, 2026, 11:00 AM EAT** (after judging ends Nov 10, 11:59 PM PT).
