# Project-page copy

Use this draft while registering. It describes the current local prototype
and clearly labels cloud/model integration as planned. Update it after a
successful live Foundry run and Azure deployment; do not present plans as done.

## Title

Pulse: Football Insights You Can Verify

## Tagline

Turn synthetic football events into clear, evidence-linked match stories, with an interactive pitch, tactical analytics and audience-aware explanations.

## Keywords

football analytics, explainable AI, synthetic data, sports storytelling,
multi-agent systems, Go, Python, TypeScript, Three.js, Microsoft Foundry, Azure

## Description

### Football stories need more than a scoreline

Pulse is an explainable football-insights prototype for fans, analysts and
streaming experiences. It connects match actions to understandable stories
and lets viewers inspect the evidence behind an insight instead of simply
trusting an AI-generated sentence.

### Facts first, explanations second

Our Go engine replays fictional football sequences on one shared match clock,
calculates statistics and builds evidence-linked fact packs. A browser pitch
shows player movement and ball actions in 3D or 2D. Passing networks show who
connected with whom, while attacking-route panels track lane usage, penalty-area
entries and entry-to-shot conversion under an explicit attribution rule.

The local prototype includes three authored scenarios, Casual and Analyst
explanations, clickable evidence replay and a downloadable sequence recap.
Rewinding also rewinds the statistics, so future actions cannot appear as
current evidence. All clubs, players and match data in the demo are fictional.

### Purposeful agent collaboration

We are preparing three Python agents: an Explainer selects supported meaning,
a Narrator adapts the wording for the viewer, and a Verifier checks each claim
against the fact pack. Their workflow has bounded retries and deterministic
template fallback. The current browser uses trusted templates; a Microsoft
Foundry REST adapter and offline test harness are implemented, but live model
integration has not yet been demonstrated. Model agreement alone will not
override the final Go publishing checks.

### Goals for the submitted demo

Connect the model-backed workflow through Microsoft Foundry, deploy the Go
and Python services to Azure Container Apps, and demonstrate an explanation
whose supporting events can be replayed. We also plan reviewed English and
Kiswahili storytelling. Cloud deployment, broader model-generated wording
and Kiswahili are not claimed as working in this registration draft.

Pulse's goal is simple: make football intelligence understandable, inspectable
and adaptable, without allowing an AI model to invent the match.

## Challenge

Select the **Inside the Game** challenge belonging to this hackathon. The exact
dropdown label still needs checking on your project form. Do not select a
different Microsoft event just because its wording also mentions agents.

If the form instead asks for a prize category, **Best Multi-Agent System Prize**
is a candidate after live specialized agents are demonstrated. The official
rules also list Foundry and Azure categories; their existence does not mean
the current local prototype already qualifies for those implementation claims.
[Official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).

## Writing code

Yes.

## Code repository

https://github.com/alexwafula/pulse

Before final submission, confirm this repository link shows the latest tested
features and keep the project description aligned with what actually runs.

## Skills needed / joining

Choose **Yes** if you are actively welcoming more contributors; otherwise
choose **No**. Suggested skills: Python agent development, Microsoft Foundry,
Azure Container Apps, Go, TypeScript/Three.js, football analytics, evaluation
and testing, UI/UX, native Kiswahili review, and demo-video editing.

Suggested joining text:

We welcome focused contributions in Python agent verification, Foundry/Azure
integration, TypeScript visualization, synthetic football scenarios and native
Kiswahili review. Please coordinate shared-contract changes with the team.

## Media

Actual product screenshots are generated into `docs/media/` by
`node tests/integration/capture-media.mjs` with the local server running.
Use `pulse-overview.png` as the cover, then `pulse-analytics.png`,
`pulse-tactics.png`, `pulse-evidence.png` and `pulse-recap.png`. Captions should identify the fictional replay and the
current template mode. Do not imply these are real match footage or live AI.

The official final submission calls for a functioning-demo video under two
minutes, a public video URL on an accepted platform, and a public GitHub repo.
Screenshots alone are not a replacement for that final video.
[Submission requirements](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).

### Suggested 90-second video outline

1. 0-10 s: "Pulse connects football actions to explanations you can inspect."
2. 10-30 s: play the fictional sequence; show the pitch and synchronized actions.
3. 30-45 s: show passing links and attacking routes; inspect one pass.
4. 45-65 s: show the corner insight and replay its evidence.
5. 65-80 s: switch Casual/Analyst, show the sequence recap.
6. 80-90 s: after deployment/model testing, show the Azure URL and actual
   Foundry run/rejection logs. Until then, label this segment planned rather
   than fabricating a completed cloud/AI demo.

Avoid unlicensed real-match footage, club marks, copyrighted music and secrets.
