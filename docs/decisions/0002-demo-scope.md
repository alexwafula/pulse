# 0002: Demo scope after team-plan review

Status: working scope, reviewed against the team-plan draft on October 4, 2026.

The PDF proposes seven agent roles, a Next.js UI, a Control vs Chaos headline
metric, several managed streaming services and spoken commentary for version
one. For the first complete demo we will use Go templates and HTMX for pages,
a dedicated TypeScript/SVG pitch renderer, and three AI responsibilities:
Analyst/Explainer, Storyteller and Verifier. These changes reduce integration
work while retaining the facts-first idea and the Evidence Trail.

Build order:

1. Versioned Match, Event, Tracking, Fact Pack and Overlay Cue contracts.
2. Fictional 60-second replay with one match clock.
3. Go live delivery and a browser pitch with play/pause. The transport
   recommendation from the architecture brief is recorded in
   [0003](0003-architecture-brief-review.md).
4. Deterministic attacking-lane and set-piece facts from Go, sent to a
   Python `/insights` endpoint that initially returns a template cue.
5. Evidence-linked cue display, then the three agent responsibilities,
   code-based number/reference/time checks, English/Kiswahili and recap.

Show pitch control, pressure and other component metrics separately before
promoting a Control vs Chaos formula. Test metrics on unseen seeds and
scenarios. Defer Event Hubs, Redis, managed push, Foundry IQ, Fabric, two-voice
commentary, advanced recruitment and goalkeeper features until the core demo
works. The first fixture and contract examples do not claim calculated metrics
or AI verification.

The [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md)
confirm registration ends October 20, 2026 at 12:00 PM Pacific Time, and
submissions close October 27, 2026 at 11:59 PM Pacific Time. They require a
public GitHub repository at submission. Our repository is private while the
team prepares it; change visibility before submitting. Each teammate should
read the eligibility section for their own circumstances.
