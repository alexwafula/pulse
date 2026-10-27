# Pulse — Final Hackathon Portal Submission Pack

> **Deadline Reminder:** Hard submission deadline is **Wednesday, October 28, 2026 at ~10:00 AM EAT** (Tuesday, October 27, 2026 at 11:59 PM PT).
> Keep the Azure deployment running until at least **Wednesday, November 11, 2026 at 11:00 AM EAT** (after judging ends November 10, 11:59 PM PT).

---

## 1. Portal Fields (Copy & Paste Directly)

### Project Title
```text
Pulse: Football Insights You Can Verify
```

### Tagline
```text
Turn synthetic football events into clear, evidence-linked match stories, with an interactive pitch, tactical analytics and audience-aware explanations.
```

### Challenge
```text
The Synthetic Match Insights Engine for Premier League Studio
```

### Keywords / Tags
```text
Multilingual Storytelling, Football Analytics, synthetic-data, explainable AI, multi-agent systems, Go, Python, TypeScript, Three.js, Microsoft Foundry, Azure Container Apps
```

### Writing Code
```text
Yes
```

### Code Repository URL
```text
https://github.com/alexwafula/pulse
```

### Live Demo URL (for Judges)
```text
https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/
```
*(Direct deep links also embedded in the Description below:)*
- **End to End (90s Two-Sided 11v11, Broadcast Camera, Shot Lens & Player Spotlight):** `https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=end-to-end&view=three`
- **Corner Chance (Verified Recorded Insight, Fact Check, Agent Inspector & Safety Test):** `https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=corner&view=three&locale=en-GB&persona=CASUAL`
- **Late Siege (11v11 Open-Play Insight, Sustained Pressure, Heatmap & What Changed?):** `https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=late-siege&view=three`

### Registered Team Members (4 Members)
- **Jefferson Gakuya** — Pipeline, Go engine, metrics, cue gate & web experience
- **Alex Wafula** — Python agents, Microsoft Foundry integration, evaluations & Azure deployment
- **Ved Shah** — UI/UX design & Matchlens visual system prototype
- **Dhruvi Parekh** — Product, QA, scenario verification & submission readiness

---

## 2. Full Project Description (Copy & Paste into Portal Description Box)

### Live Demo & Judge Access
- **Live Azure App (No login required):** https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/
- **End to End 11v11 (3D Broadcast camera, Shot Lens & Player Spotlight):** https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=end-to-end&view=three
- **Corner Chance (Verified Recorded Insight, Agent Inspector & Safety Test):** https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=corner&view=three&locale=en-GB&persona=CASUAL
- **Late Siege 11v11 (Open-Play Pass Insight, Sustained Pressure, Heatmap & What Changed?):** https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=late-siege&view=three
- **Judge Walkthrough Guide:** https://github.com/alexwafula/pulse/blob/main/docs/JUDGE-INSTRUCTIONS.md

### Football stories need more than a scoreline

Pulse is an explainable football-insights engine for fans, studio analysts and streaming overlays. It connects synthetic match actions to understandable tactical stories and lets viewers inspect and replay the exact source events behind every insight instead of blindly trusting an AI-generated sentence.

### Facts first, explanations second

Our deterministic Go engine replays synthetic football sequences on one shared match clock, computes spatial and event statistics, and builds evidence-linked fact packs. The browser workspace renders player movement and ball actions in **3D (Three.js)**, **2D (PixiJS)**, or **SVG**, with automatic **Broadcast**, orthographic **Tactical**, and **Follow ball** camera framing, monotone Hermite player interpolation, and distance-driven procedural footwork.

Pulse ships with **six synthetic scenarios**—three authored tactical passages (*Corner chance*, *Central entry*, *Passing exchange*) and three seeded 11v11 replays (*Late siege*, *End to end* two-sided play, and *Calm midfield*):
- **Match Briefing & Read the Game:** Spoiler-free setup prompts, trailing 20-second team pass comparisons, **Shot Lens** geometry (distance to goal centre and visible angle between the 7.32 m goalposts), and **Player Spotlight** (trailing 8-second movement trail and source-event links).
- **Insights & What Changed?:** Go-calculated passing networks, attacking-lane progression, sample-and-hold player-time occupancy heatmaps, evidenced shot maps, and **What changed?** (adjacent 10/20/30-second same-team window comparisons with pitch diagrams and bounded window replay).
- **Story, Recap & Sharing:** Clock-bounded *Live story*, *Catch up*, *Highlights*, and *Player focus* views, a deterministic downloadable text **Recap** at sequence end, replay-fingerprinted **Copy evidence links** that restore exact paused state, and fullscreen **Broadcast mode** with match-timed, provenance-labelled captions. Rewinding the clock rewinds every chart, map, and stat so future actions never leak into current evidence. All clubs, players, kits, and match data are 100% synthetic and fictional.

### Purposeful multi-agent collaboration & Agent Inspector

Three specialized Python agents collaborate over structured JSON Schema contracts (`FactPack` -> `NarrationDraft` -> `VerificationResult`) backed by **Microsoft Foundry (`gpt-4.1-mini`, `2025-04-14`)**:
1. **Explainer:** Selects supported tactical meaning from the Go fact pack with cited fact IDs.
2. **Narrator:** Adapts phrasing for the selected audience persona (**Casual** or **Analyst**) within strict character and claim rules.
3. **Verifier:** Checks every claim and ordered source event ID against the fact pack. Rejections trigger a single bounded retry before falling back to a deterministic template (`FALLBACK_TEMPLATE`).

Model agreement alone never publishes prose: the **Go cue gate** independently recomputes the fact pack from source replay events and verifies every claim before delivery. Two narrow event-backed patterns are enabled for model-verified publication (`set_piece_shots` after a corner and `open_play_passes_before_shot` in a 20-second open-play phase), guarded by 40 offline adversarial boundary evaluations (zero false accepts) and shared Go/Python contract examples.

Beneath any displayed insight, **Agent Inspector** exposes the computed fact pack, delivery timing, independent Go gate check, retained three-role Foundry completion records (response IDs, token usage, role outputs), and an interactive **Safety test** where judges can inject a fabricated claim and watch the Go gate reject it and recover to a safe template.

### Cloud deployment, localization & honest boundaries

Go (`pulse-web`) and Python (`pulse-agents`) run on **Azure Container Apps** in South Africa North, built and smoke-tested via passwordless GitHub Actions OIDC federation into Azure Container Registry, with service-token authentication between services and Log Analytics ingestion. To guarantee zero quota or latency failures during judging through November 10, the public demo runs in **`recorded` mode** (model request cap `0`), serving request-matched Foundry outputs labelled **`Verified (recorded)`** and deterministic **`Template`** fallbacks with zero runtime model calls.

Interface copy and deterministic templates support **English (`en-GB`)**, **Kiswahili (`sw-KE`)**, and **Hindi (`hi-IN`)**; non-English requests are template-only and never claim LLM verification. Spatial pitch-control, pressing, and Control vs Chaos values are explicitly labelled **`model estimate, uncalibrated`**, sustained-pressure explanations are labelled **`Template / Not model-verified`**, heatmaps measure tracking player-time rather than touches, and scores remain unavailable rather than `0:0`.

Pulse's goal is simple: make football intelligence understandable, inspectable and adaptable, without allowing an AI model to invent the match.

---

## 3. Images/Video (Fill All 5/5 Portal Slots)

The portal supports **5 media items** (`Images/Video 1/5`). Use these exact 5 files from `docs/media/`:

1. **Slot 1 (Demo Video — 1m 34s MP4 with English Narration):** `docs/media/demo-draft/pulse-demo.mp4` (`29.2 MB`, `1280x720` H.264 video + 128 kbps AAC English audio track, compatible with the portal's Azure AI Video Indexer uploader).
2. **Slot 2 (Cover / Hero 3D Workspace):** `docs/media/pulse-experience-live.png` — Two-sided 11v11 `end-to-end` replay in the 3D Broadcast camera with Shot geometry overlay (`24.2 m | 17.1°`), `#9 Bram` Player Spotlight movement trail, Control vs Chaos headline, and Match insight.
3. **Slot 3 (Agent Inspector & Safety Test):** `docs/media/pulse-inspector.png` — 3-role Microsoft Foundry (`gpt-4.1-mini-2025-04-14`) completion records (`Explainer`, `Narrator`, `Verifier`) with response IDs and tokens, plus the interactive **Safety test** (`The corner produced 2 shots.` -> `Rejected by Go gate. Safe template passed.`).
4. **Slot 4 (What Changed? Window Comparison):** `docs/media/pulse-what-changed.png` — Side-by-side 20-second pitch diagrams (`88:06 - 88:26` vs `88:26 - 88:46`) in `late-siege` showing pass/shot progression and clickable source-event chips.
5. **Slot 5 (Read the Game / Heatmap / Broadcast Mode — pick your favourite):**
   - `docs/media/pulse-shot-lens-spotlight.png` (Read the game: Shot Lens `24.2 m / 17.1°` + Player Spotlight `#9 Bram` stats)
   - *or* `docs/media/pulse-broadcast.png` (Fullscreen 3D Broadcast mode with `Verified (recorded)` caption overlay)
   - *or* `docs/media/pulse-experience-heatmap.png` (Player-time occupancy heatmap & attacking-lane bars)
   - *or* `docs/media/pulse-experience-graphs.png` (Cumulative completed passes, shot attempts & box entries)

---

## 4. Refreshed Demo Video Timeline (`94.2 seconds` MP4 / `92.04 seconds` WebM)

- **Portal Upload File (MP4 + English Voiceover):** `docs/media/demo-draft/pulse-demo.mp4` (`29.2 MB`, `1280x720` H.264 + AAC English narration synced to all 16 scenes for Azure AI Video Indexer)
- **Raw Capture File (WebM):** `docs/media/demo-draft/pulse-demo.webm` (`7.35 MB`, `1440x1000` VP8/WebM, `92,043 ms`, zero console/page errors)
- **Scene-by-scene timeline (`docs/media/demo-draft/capture.json`):**
  1. **`0:01` (`end-to-end`):** *"Pulse turns synthetic 11v11 football replays into explainable, verifiable match stories."* (3D Broadcast camera & procedural footwork)
  2. **`0:07` (`end-to-end`):** *"Read the game: Go calculates Shot Lens geometry and an 8-second Player Spotlight trail."*
  3. **`0:14` (`late-siege`):** *"Late siege: a checked open-play pass-count insight with captured 3-role Foundry provenance."*
  4. **`0:19` (`late-siege`):** *"Go detects sustained pressure from source events and ticks—explicitly labelled as a template."*
  5. **`0:25` (`late-siege`):** *"Analyst exposes the action count, model estimate and source window. Tracking is uncalibrated."*
  6. **`0:30` (`late-siege`):** *"Charts use Go-calculated replay data. Rewinding also rewinds the statistics."*
  7. **`0:35` (`late-siege`):** *"Heatmaps show recorded player-time, not touches, possession or measured pressure."*
  8. **`0:41` (`late-siege`):** *"What changed? compares adjacent 20-second source-event windows with pitch diagrams."*
  9. **`0:47` (`corner`):** *"The corner insight is a checked recording. The public demo makes no fresh model calls."*
  10. **`0:52` (`corner`):** *"Fact check and Safety test: the Go cue gate rejects an injected bad claim and falls back safely."*
  11. **`0:58` (`corner`):** *"Evidence replays the recorded corner and shot on the same match clock."*
  12. **`1:03` (`corner`):** *"Broadcast mode expands the pitch with match-timed, provenance-labelled captions."*
  13. **`1:09` (`corner`):** *"Casual and Analyst adapt the wording, not the facts. Analyst uses a deterministic template."*
  14. **`1:14` (`corner`):** *"Kiswahili and Hindi interface and template options use deterministic source facts."*
  15. **`1:19` (`corner`):** *"A deterministic recap keeps event evidence and downloads as text. No invented match result."*
  16. **`1:24` (`corner`):** *"Go + Python agents + HTMX + TypeScript. Azure Container Apps hosting and Microsoft Foundry."*
