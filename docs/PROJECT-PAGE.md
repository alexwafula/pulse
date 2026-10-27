# Project-page copy (Ready to paste into Hackathon Portal)

Updated October 27, 2026 (`main` at `aed03f9`, PR #49 merged). Replaces the October 8 registration draft with the complete, deployed and verified feature set.

---

## Title

Pulse: Football Insights You Can Verify

## Tagline

Turn synthetic football events into clear, evidence-linked match stories, with an interactive pitch, tactical analytics and audience-aware explanations.

## Challenge

The Synthetic Match Insights Engine for Premier League Studio

## Keywords

Multilingual Storytelling, Football Analytics, synthetic-data, explainable AI, multi-agent systems, Go, Python, TypeScript, Three.js, Microsoft Foundry, Azure Container Apps

---

## Description (Copy & Paste into Portal)

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

## Writing Code

Yes

## Code Repository

https://github.com/alexwafula/pulse

## Live Demo URL (for Judges)

- **Main Match Workspace:** https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/
- **End-to-End 11v11 Two-Sided Replay:** https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=end-to-end&view=three
- **Verified (recorded) Corner Insight & Agent Inspector:** https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=corner&view=three

## Team Members

Four registered team members:
- **Jefferson Gakuya** — Pipeline, Go engine, metrics, cue gate & web experience
- **Alex Wafula** — Python agents, Microsoft Foundry integration, evaluations & Azure deployment
- **Ved Shah** — UI/UX design & Matchlens visual system prototype
- **Dhruvi Parekh** — Product, QA, scenario verification & submission readiness

## Media

- Upload `docs/media/demo-draft/pulse-demo.webm` (under 2 minutes, 1440x1000 captioned product capture, zero real-world trademarks or unlicensed music) to YouTube or Vimeo (public or unlisted-public, verified while signed out) and paste the link on the project page.
- Upload up to 4 product screenshots from `docs/media/` (`pulse-experience-live.png`, `pulse-experience-graphs.png`, `pulse-experience-heatmap.png`, `pulse-evidence.png`).
