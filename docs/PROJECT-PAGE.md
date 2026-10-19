# Project-page copy

Updated October 18, 2026. Hosting and one bounded live workflow were demonstrated;
the public judge demo deliberately uses recorded output and deterministic templates,
not fresh model calls. The readiness additions are local until merged/deployed.

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

The prototype includes three authored scenarios and two seeded 11v11 sequences, Casual and Analyst
explanations, clickable evidence replay and a downloadable sequence recap.
Rewinding also rewinds the statistics, so future actions cannot appear as
current evidence. All clubs, players and match data in the demo are fictional.

### Purposeful agent collaboration

Three Python agents are wired: an Explainer selects supported meaning,
a Narrator adapts the wording for the viewer, and a Verifier checks each claim
against the fact pack. Their workflow has bounded retries and deterministic
template fallback. One explicitly capped, English Casual corner workflow passed
Python and independent Go checks on October 13. The public Azure demo serves that
stored response as **Verified (recorded)** only when the complete request matches;
other supported requests use templates. This is not a general live-model quality
claim. The recording declares Foundry/model metadata; original provider-response
provenance remains pending. Model agreement alone cannot override Go's gate.

Oct 19 branch addition (include only after deployment): Agent Inspector exposes
source facts, delivery and independent publication checks. A separately captured
three-role Foundry reference run reproduces the stored response and retains actual
provider IDs, role outputs, usage and timings; it does not recover original-capture
provenance. What Changed? compares equal, elapsed source-event windows for one
team, with pitch diagrams and replay links. It reports observed changes, not cause.

### Deployment and current limits

Go and Python are deployed to Azure Container Apps, with GitHub Actions builds,
Azure Container Registry and service-authenticated insight requests. Microsoft
Foundry is provisioned for opt-in bounded development runs; public model calls
remain disabled. Console logs are available in Log Analytics.

The readiness branch adds evidence-backed sustained-pressure templates. These
are **not model-verified**. Tracking-derived control values are uncalibrated
model estimates. English, Kiswahili and Hindi interface/template options exist;
Kiswahili/Hindi remain drafts pending native review. Recaps are deterministic,
scores are unavailable, and no goal, live event streaming or speech is claimed.

Pulse's goal is simple: make football intelligence understandable, inspectable
and adaptable, without allowing an AI model to invent the match.

## Challenge

Select the **Inside the Game** challenge belonging to this hackathon. The exact
dropdown label still needs checking on your project form. Do not select a
different Microsoft event just because its wording also mentions agents.

If the form instead asks for a prize category, **Best Multi-Agent System Prize**
is a candidate for the bounded specialized workflow; do not describe the recorded
public demo as a fresh live-agent evaluation. The official
rules also list Foundry and Azure categories; their existence does not mean
the project automatically qualifies for a prize or any unimplemented claim.
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

Use the actual product screenshots in `docs/media/`. The readiness recording
script is `node scripts/capture-demo.mjs` against the local recorded service.
See [demo script and upload checklist](DEMO-VIDEO.md) and
[judge instructions](JUDGE-INSTRUCTIONS.md). All footage is fictional replay;
recorded/template output must not be described as fresh AI generation.

The official final submission calls for a functioning-demo video under two
minutes, a public video URL on an accepted platform, and a public GitHub repo.
Screenshots alone are not a replacement for that final video.
[Submission requirements](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).

Avoid unlicensed real-match footage, club marks, copyrighted music and secrets.
Publish only after [permission and review sign-offs](SUBMISSION-READINESS.md).
