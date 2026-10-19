> **Status, 19 Oct 2026.** Amended against origin/main `fd2cd3539250589982aee67253252f6c37ae2ebf` (`fd2cd35`, merge of #39). The direction below is the agreed spec and is kept as written. Amendments are marked **Status** or **Superseded**, and superseded text is struck through rather than deleted.
>
> Visual reference: Matchlens prototype by Ved (registered Pulse team member), made with claude.ai; permission to derive the UI granted; prototype kept outside the repo; see ADRs 0012, 0013 and 0015 (`docs/decisions/0012-experience-integration-preview.md`, `0013-port-on-field-presentation.md`, `0015-prototype-visual-system.md`). The repo record has not caught up yet: `docs/SUBMISSION-READINESS.md:18` still lists the contributor permission as "UNCONFIRMED; blocks submission".
>
> | PR | Status | Source |
> |---|---|---|
> | D2a | **Done**: #36, merge `1276f61` | `gh pr view 36`: "feat(web): semantic light tokens and team colour by identity (D2a)", MERGED 2026-10-18 |
> | D2b | **Deferred** until after judging | Team decision, 19 Oct. `experience.css:5` still forces `color-scheme: light`; ADR 0025:12-13 "No dark values yet" |
> | D3a | **Done**: #38, merge `1a9c473` | `gh pr view 38`: "feat(web): D3a hero with API index headline and server-rendered team kits", MERGED 2026-10-18 |
> | D3b | **Next** | No PR yet: `gh pr list --state all` has no D3b entry |
> | D4a | **Next**, after D3b | No branch or PR yet (`gh pr list --state all`) |
> | D4b | **Next**, after D3b | No branch or PR yet (`gh pr list --state all`) |
>
> #37 ("fix(web): answer HEAD on HTML and health routes", merge `fcf275a`) is not a D-series PR. D3a was based on it (#38 body: "based on `main` at `fcf275a` (#37)").

# Pulse match experience: design direction (18 Oct 2026)

**Scope.** This was a read-only audit. No tracked file was edited and nothing was committed or pushed. The UI is `/` at **origin/main `57dc69c`**, served from a `git archive` export on `127.0.0.1:18180`. The Python service ran in `recorded` mode on `:18190` and made no model calls. The visual reference is `~/src/matchlens-reference/index.html`, opened from disk; we take its visual language only. Screenshots are in `shots/`. `metrics-*.json` holds per-state measurements: contrast, targets, type, radii, shadows and transitions. `scripts/` holds the capture code.

**Caveats.**
- **Load during capture.** Each run started only once the 1-minute load average was below 2.0. The swiftshader WebGL captures, plus another agent session, then pushed load to 4–17 during runs; each record in `metrics-*.json` stores its load. Colour, size and layout values do not depend on load, so nothing here reports timing except First Contentful Paint, as recorded by the browser.
- **Earlier commit.** A first pass ran on `1b2c8b9`. PRs #32 and #33 then merged UI changes, so every shot was retaken on `57dc69c`. The old shots are kept in `superseded-1b2c8b9/` for comparison only.
- **Viewports.** 1440×900 is desktop; 390×844 is mobile, captured at DPR 2.

## 1. Captured judge path

| Step | Desktop / mobile file (`shots/`) | Measured state |
|---|---|---|
| First paint; +3 s | `*-01-first-paint`, `*-02-load-3s(-full)` | FCP 544 ms desktop. The replay **autoplays**: the clock reads 88:12 three seconds after load. |
| Live playing | `*-03-live-playing` | Three.js renderer (`.pitch-shell[data-renderer=three]`) |
| 88:11 pressure banner | `*-04-pressure-banner`, `desktop-04b-banner-crop` | `#moment-banner`: "Sustained pressure / Aurora Vale / 88:11 / model estimate, uncalibrated". `#pressure-insight` panel shows "Template … Not model-verified". |
| Control → Detected moments → Evidence trail | `*-05a-control-moments`, `*-05b-evidence-trail(-full)` | `[data-source-event]` = evt-03, evt-04, evt-05, followed by **6 tick rows** |
| Corner end, Fact check open | `*-06-corner-verified-factcheck(-full)`, `desktop-06b-insight-crop` | `#insight-status` = "Verified (recorded)"; claims 1/1 |
| Analyst | `*-07-analyst` | Status "Template" (Analyst is template by design) |
| Calm midfield, 0 moments | `*-08-calm-zero-moments` | `#moments-state` "No moments detected". Index difference −0.4287, "Bastion City − Aurora Vale". |
| Loading / error / no-tracking | `*-09a-loading`, `*-09b-error`, `*-10-no-tracking-corner` | Error text is the raw "Failed to fetch". Shot 10 was taken with **Analyst** persona active. |
| hi-IN | `*-11-hi-IN(-full)` | No horizontal overflow at either viewport (`scrollWidth` = `innerWidth`) |
| Renderers | `*-12-banner-{svg,pixi,three}` | The banner box is identical (252×54 at 12,12) in all three |
| Prototype | `proto-{desktop,mobile}-{live,hero,cards,timeline,nav}` | "timeline" is the whole `.livemain` column. The mobile prototype renders inside a phone frame. |

## 2. Diagnosis (measured)

**Hierarchy: the eye lands on chrome, not on the match.** The largest above-the-fold text on desktop is the 34px/800 "Live" screen title (`h1#workspace-title`), then the 25px "Pulse" wordmark, then the 28px "– : –" (`.score-unavailable`) (`desktop-02-load-3s`). The **Index difference**, the product's headline number, is the sixth tile in `#pane-control` (`dd#metric-index-delta`). Its own 18px rule (`pitch.css` `.metric-headline dd`) loses to `.experience .metric-values dd` (25px), so it renders exactly like the five secondary tiles above it, and it sits below the fold in `desktop-05a` and `desktop-10`. On mobile the pitch starts about 545 CSS px down, after the brand, Scenarios, persona, language, the "Live" title and the team strip (`mobile-02-load-3s`). The prototype puts a 28px-radius hero (teams, clock) first and the pitch directly under it (`proto-desktop-hero`).

**Typography.** Three families render in the experience:

| Family | Text nodes (desktop) | Where |
|---|---|---|
| Plus Jakarta Sans | 112 | Body (`desktop-02` metrics) |
| Inter | 30 | Clocks, evidence IDs and times; `--font-tabular` is never overridden for `.experience` (`pitch.css:404,691,905,1022,1158,1230,1339,1445`) |
| Outfit | 18 | Display |

The build label adds `ui-monospace`. Space Grotesk is declared in `tokens.css` but unused here.

The CSS uses **21 distinct font sizes, from 2px to 34px**. At desktop, 81 text nodes are 11px, 12 are 10px and 1 is 9px. Measured weights: 96 nodes at 700, 45 at 400, almost nothing between. Outfit and Plus Jakarta both ship a `tnum` feature, so Inter is not needed for tabular figures. **Neither has Devanagari glyphs**, so hi-IN falls back to a system font; only Inter is listed as loaded in that state.

**Colour roles.**
- `experience.css` re-skins the dark `tokens.css` with **144 hard-coded hex values against 23 `var()` uses**: `#66748a` ×27, `#2c5e77` ×20, `#3a7fd5` ×8, `#d9485f` ×7. `pitch.css:1813` references an undefined `--border-color` that only works through its hex fallback.
- **Team colour follows list order, not the team.** `pitch.ts:203,292` treat `teams[0]` as "home". `tokens.css:107-115` names the tokens `--team-aurora` (coral/red) and `--team-bastion` (blue), and the `match.html` comment says "First replay team: coral". The generated scenarios list `bastion` first. The result: **Bastion City wears the "aurora" red in late-siege** (`desktop-02`), while **Aurora Vale is red in corner** (`desktop-07`) and blue in late-siege. The crest letter, swatch, share bar, kit colour in all three renderers, and the mini score order ("B – : – A" versus "A – : – B") all flip between scenarios on the judge path.
- **One style for every status.** `#insight-status` uses the same tinted pill for VERIFIED (RECORDED), TEMPLATE, WAITING and NO MOMENT (`desktop-06b`, `desktop-07`, `desktop-08`, `pitch.ts:161`). The new `#pressure-insight` shows "Template" as an unstyled `<span>`, a fourth rendering.

**Spacing, radii, elevation.** 83 of 149 padding/margin/gap values in `experience.css` are off the 4px grid (most common: 10px ×20, 14px ×18, 6px ×13, 18px ×11). Radii in use: 2, 3, 4, 6, 8, 20, 24px, 50% and pill. The prototype uses one card radius, 26px, with one soft shadow `0 8px 26px rgba(20,26,24,.07)` (`proto-styles.json`). Pulse sets `--shadow-card: none`, `--radius-lg: 8px` (`experience.css:15-16`), so cards read as flat white boxes on `#ecedef`. The remaining shadows are leftover lime/coral glows (`rgba(200,228,109,.4)`, `rgba(234,112,92,.4)`).

**Iconography.** Lucide is bundled (19 icons in `experience.ts:1`) and drawn at 15, 16, 21 and 31px. The prototype draws one inline icon set at a single stroke weight. The size spread is the gap; the icon set itself is fine.

**Motion.**
- Measured transitions: 150ms for `all`/`background` (46 elements) and 240ms on the share bar, with no entry or exit motion for the banner or status changes.
- Under reduced motion, `tokens.css` zeroes every duration. On the judge path, selecting a moment stays on Live and jumped from 841 to 1058 px scroll within one frame in both motion modes (`scripts/probe3.json`), so no smooth scroll was observed. `pitch.ts:590,709,724` still request `behavior:"smooth"`, which the CSS rule cannot override.
- The prototype's motion is decorative (`burst`, `floatUp`, `bob`) and should **not** be ported.

**States.**
- Loading and error overlays use the legacy dark `rgba(9,14,12,.9)` panel inside the light UI. The renderer switch shows **SVG pressed** even though the URL asks for `view=three` (`desktop-09a/09b`).
- The error body is the browser string "Failed to fetch".
- No-tracking shows an engineering string, "frame gap of 8000 ms at 1628000; 5 Hz tracking (200 ms) is required", above **six N/A tiles** (`desktop-10`).
- Zero moments is a 10px muted line (`desktop-08`).
- The evidence trail repeats "Tick / 88:09 – Metric tick at 88:09" in 6 cards that outweigh the 3 source events (`desktop-05b`). During the clip the pitch is scrolled out of view.
- Two overlays stack on the pitch, the moment banner (top) and `.action-result` (bottom-left) (`desktop-07`).

**Accessibility.**
- *Focus:* 39 of 39 tabbed elements show a 2px `#2c5e77` outline offset by 3px. No failures.
- *Contrast:* the failing pairs are measured against an opaque background; text over the pitch canvas was not measured. Eight pairs fail; all but the selected-row time fail at both viewports:

| Element | Pair | Ratio | Needed |
|---|---|---|---|
| `#away-pass-share` | `#3a7fd5` on `#ecedef` | 3.46 | 4.5 |
| `#home-pass-share` | `#d9485f` on `#ecedef` | 3.56 | 4.5 |
| Nav labels, `.fixture-label`, `.team-sub`, `.half-label`, `#start-label`, `#evidence-state` | `#66748a` on `#ecedef` | 4.05 | 4.5 |
| Evidence descriptions | same pair | 4.07–4.11 | 4.5 |
| Selected row `span.event-time` (mobile) | `#66748a` on the leftover lime tint `#e8ecdf` | 3.95 | 4.5 |
| `#build-label` | `#8a95a5` on `#ecedef` | 2.59 | 4.5 |

- *Touch targets under 44px, mobile (24 of 55 at load):*

| Control | Size (px) |
|---|---|
| Casual / Analyst | 48×26, 51×26 |
| 3D / 2D / SVG | 42×28 |
| `#control-toggle` | 16×16 |
| Camera and fullscreen | 36×36 |
| `#play-button`, `#restart-button` | 36×32 |
| Speed 1×, 4×, 10× | 29×32 |
| `#seek` | 16 tall |
| Drawer tabs | 31–33 tall |
| Scenarios, Language, Camera selects | 40 tall |

**Copy and locale.** The canonical "model estimate, uncalibrated" now appears consistently (`match.html:325,406,528` and the banner). The drawer heading overflows its box in sw-KE ("Paneli ya uchambuzi wa mbinu") and hi-IN ("रणनीतिक विश्लेषण पैनल") at both viewports. The six drawer tabs already wrap to two rows in en-GB at 1440 ("Evidence" sits alone on row 2, `desktop-05a`).

## 3. Direction: "Quiet ledger"

A calm, evidence-first broadcast companion. **One** strong number per screen: the API's index difference with its label. Everything else is a ledger of what happened, each line traceable to a source. Taken from the prototype: neutral canvas, white cards with one soft shadow, the hero-first layout, the lower-third caption on the pitch, the timeline rail, the segmented pills and the filled nav item. Left behind: gradients that blend the two team colours (they read as a momentum or win meter), gamified chips, scores, predictions, bounce motion, and emotive red "LIVE" dots.

### 3.1 Token proposal (diff for `tokens.css`; legacy raw tokens stay, so `/legacy` is unaffected)

```diff
+/* Semantic layer for the match experience. experience.css consumes only these. */
+.experience {
+  /* type: Outfit = display + numerals, Plus Jakarta Sans = UI; both have tnum */
+  --font-display: Outfit, 'Plus Jakarta Sans', system-ui, sans-serif;
+  --font-ui: 'Plus Jakarta Sans', 'Noto Sans Devanagari', system-ui, sans-serif; /* system Devanagari if installed; not loaded */
+  --font-tabular: var(--font-ui);            /* + font-variant-numeric: tabular-nums; retires Inter here */
+  --text-xs: 12px/16px;  --text-sm: 13px/20px; --text-md: 15px/24px;   /* body = md; nothing below xs */
+  --text-lg: 17px/24px;  --text-xl: 20px/28px; --text-2xl: 24px/30px;
+  --text-3xl: 30px/36px; --text-num: 40px/44px;                         /* num = index-difference headline */
+  --measure: 68ch;                                                      /* insight/narrative line length */
+  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 20px;
+  --space-6: 24px; --space-8: 32px; --space-12: 48px;
+  --radius-control: 8px; --radius-card: 16px; --radius-stage: 20px; --radius-pill: 9999px;
+  --elev-0: none;
+  --elev-1: 0 1px 2px rgba(20,26,24,.06), 0 4px 16px rgba(20,26,24,.05);   /* cards */
+  --elev-2: 0 8px 26px rgba(20,26,24,.08);                                 /* hero, watch dock */
+  --elev-3: 0 20px 48px rgba(20,26,24,.16);                                /* dialog */
+  --dur-1: 120ms; --dur-2: 200ms; --dur-3: 320ms;
+  --ease-out: cubic-bezier(.2,.7,.2,1); --ease-in-out: cubic-bezier(.4,0,.2,1); --ease-exit: cubic-bezier(.4,0,1,1);
+  /* colour roles, light (pairs measured below) */
+  --c-canvas: #f2f3f5; --c-surface: #ffffff; --c-surface-2: #eef0f2; --c-rule: #dde1e6;
+  --c-ink: #1c2838; --c-ink-muted: #4f5d72;
+  --c-accent: #24536a; --c-on-accent: #ffffff; --c-accent-tint: #e4eef3;
+  --c-team-a: #b8374d; --c-team-b: #2e68b3;   /* = match.teams[0] / [1]; replaces --team-aurora/--team-bastion */
+  /* Superseded (19 Oct): kit a/b now follows the team id, not teams[0]/[1]. See "On team colour" below. */
+  --c-team-a-tint: #f7e3e7; --c-team-b-tint: #e3ecf8;
+  --c-verified: #1e6b48; --c-verified-tint: #e3f1ea;
+  --c-template: #5c6675; --c-template-tint: #eef0f2;
+  --c-estimate: #8a5a00; --c-estimate-tint: #fbf1dc;  /* chip for "model estimate, uncalibrated" */
+  --c-error: #a8321f;                                  /* always with icon + text: shares hue with team A */
+  --c-overlay: rgba(16,22,31,.88);                     /* lower-third and loading panel on the pitch */
+}
+@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .experience { --c-canvas:#10161f; --c-surface:#18212d;
+  --c-surface-2:#1f2a38; --c-rule:#2a3646; --c-ink:#e6ebf2; --c-ink-muted:#9aa7b8; --c-accent:#7fb8d4; --c-on-accent:#0d1a22;
+  --c-accent-tint:#1d3140; --c-team-a:#ef7d90; --c-team-b:#6aa5ee; --c-verified:#5cc293; --c-estimate:#e8b45a; --c-error:#f08a76;
+  --elev-1: 0 1px 2px rgba(0,0,0,.4); --elev-2: 0 8px 26px rgba(0,0,0,.35); } }
+:root[data-theme="dark"] .experience { /* same values as the media block */ }
+/* Superseded (19 Oct): the dark block above is deferred with D2b until after judging. D2a (#36) shipped the light roles only. */
 @media (prefers-reduced-motion: reduce) {
-  :root { --motion-fast: 0ms; --motion-base: 0ms; --motion-slow: 0ms; }
+  :root, .experience { --motion-fast: 0ms; --motion-base: 0ms; --motion-slow: 0ms; --dur-2: 120ms; --dur-3: 120ms; }
+  /* keep opacity fades at 120ms; components drop every transform under this query */
```

The reduced-motion rule also needs a JS change: `pitch.ts` must pass `behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"`.

**Contrast of the proposed pairs** (computed WCAG 2.x, normal text needs 4.5):

| Theme | Pair | Ratio |
|---|---|---|
| Light | ink / canvas | 13.41 |
| Light | muted / canvas | 6.02 |
| Light | muted / surface | 6.69 |
| Light | on-accent / accent | 8.33 |
| Light | accent / accent-tint | 7.07 |
| Light | team-a / canvas | 5.12 |
| Light | team-b / canvas | 5.05 |
| Light | verified / tint | 5.55 |
| Light | template / tint | 5.09 |
| Light | estimate / tint | 5.28 |
| Dark | ink / canvas | 15.16 |
| Dark | muted / surface | 6.64 |
| Dark | team-a / surface | 6.19 |
| Dark | team-b / surface | 6.36 |
| Dark | verified / surface | 7.41 |
| Dark | estimate / surface | 8.58 |

**On team colour.** ~~Renaming to `--c-team-a`/`-b` makes the positional rule honest and fixes the token-name swap. It does **not** keep Aurora Vale the same colour across scenarios. That needs a per-team colour in match metadata, which is a contract change: ask the other engineer first, and keep it outside D2–D4.~~

> **Superseded (19 Oct).** Team colour follows the team id, with no contract change. `app/internal/transport/http/team_kit.go:9-16` maps `vale` to kit a and `bastion` to kit b. An unknown id takes the kit its opponent does not wear. The server renders the kits on first paint (ADR 0026; #38), and `team-colour.ts` only reads them (ADR 0025). Checked by `tests/integration/tokens-browser.mjs` and `team_kit_test.go`.

### 3.2 Component changes on the judge path

| # | Component | Before | Change | Files | Risk | Size | Status (19 Oct) |
|---|---|---|---|---|---|---|---|
| C1 | **Match header / hero** | `desktop-02`, `mobile-02` | Replace the "Live" h1 and team strip with a hero card (`--elev-2`, `--radius-stage`): team names with their swatches, clock, ~~"Score not recorded"~~ **Superseded: "Score unavailable" (note 2)** as a 12px label (no "– : –" glyph), and ~~the **API index difference as the headline** (`--text-num`, sign plus "Bastion City − Aurora Vale", estimate chip)~~ **Superseded: a sentence headline plus the exact signed value with U+2212, the team-order label and the estimate chip (note 1)**. Mobile: ~~persona and language move into one 44px row~~ **Superseded: two 44px rows (note 3)**, and the pitch starts within the first 360px. | `match.html` (strip, header), `experience.css`, `analytics.ts` (write the existing `indexDelta` to a second node) | Two copies of one value must update from the same tick. A diverging bar would read as a meter, so **number only**. | M | **Done** in D3a: #38, merge `1a9c473`. Desktop header targets are still 28px (#38 body, "Known limits"). The header mini score still shows "– : –" (`match.html:136`). |
| C2 | **Moment banner → lower third** | `desktop-04b`, `*-12-banner-*` | One caption bar at the bottom of the pitch (`--c-overlay`, 3px team-colour rule, 15/13px). It **absorbs `.action-result`**, so only one overlay shows. Estimate chip stays inline. | `pitch.css:1796-1798`, `experience.css` (banner rules), `analytics.ts:277-278`, `pitch.ts` (action result) | Covers the bottom touchline in the Three.js camera, so check all 3 renderers | S | **Next** (D3b; no PR yet) |
| C3 | **Verified / Template badge** | `desktop-06b`, `desktop-07`, `desktop-08` | `data-status` on `#insight-status` and `#pressure-insight`: Verified = green tint + check icon. "(recorded)" is a suffix in the same style. Template = neutral outline + document icon. Waiting / No moment = plain muted text, no pill. Unavailable = error icon + text. | `pitch.ts:161,177,183`, `analytics.ts` (pressure panel), `match.html:326` and pressure section, `pitch.css:1000-1010` | Test selectors read the text, so keep the text unchanged | S | **Next** (D3b; no PR yet) |
| C4 | **Evidence trail** | `desktop-05b`, `mobile-05b` | Timeline rail (prototype `.card` timeline): source events as rows (ID chip, tabular time, ≥4.5:1 description). Metric ticks collapse into one row, "6 metric ticks 88:09–88:11, model estimate, uncalibrated", which expands on demand. During the clip, show the trail directly under the pitch on Live, not 900px down the right column. | `analytics.ts` (`renderEvidence`), `pitch.css:1424-1470`, `experience.css`, `match.html:513-520` | `analytics-browser.mjs` counts `[data-source-tick]`, so keep the nodes and collapse them visually | M | **Next** (D4a, after D3b) |
| C5 | **Drawer tabs** | `desktop-05a` (wraps), `mobile-05b` | Single-row segmented control, 44px tall, horizontal scroll with an edge fade. No wrapping at 1440 in any locale. The heading truncates with a title attribute. | `experience.css` (`.drawer-tabs`, `.drawer-tab`), `pitch.css:1062-1095,1804` | Arrow-key tab behaviour (`analytics-browser` tests) must keep working | S | **Next** (D4b, after D3b) |
| C6 | **Event timeline** | `desktop-02` right column | Rail with a team dot per row, a fixed tabular time column, 13px description at `--c-ink-muted` 6.0:1, and the selected row in accent tint (as now). | `experience.css` (`.event-button`), `pitch.css` | Low | S | **Next** (D4a, after D3b) |
| C7 | **Loading / error / no-tracking / zero moments** | `*-09a`, `*-09b`, `*-10`, `*-08` | Light panel on the pitch area with a skeleton pitch outline. The renderer switch is disabled until the replay loads, so SVG no longer shows as pressed. Error: "Replay unavailable. Check your connection and retry." with the raw reason in `<details>`. No-tracking: one empty-state card, ~~"Tracking-based metrics need 5 Hz tracking; this replay has none"~~ **Superseded: the copy must state the real reason, a gap in the tracking (note 4)**, replacing six N/A tiles (raw reason in `<details>`). Zero moments: an empty card with the `moments-state` text at 13px. | `pitch.css:1472-1520`, `match.html:213-220`, `pitch.ts:183,609`, `analytics.ts:123-124` | Tests assert the "N/A" values and the "Tracking metrics unavailable" label, so keep them in the DOM | M | **Next** (D4b, after D3b) |

**Superseded, 19 Oct (sources):**

1. **Headline.** The hero shows the sentence "`<team>`'s control index is N higher" (N at 2 dp), or "Neither team's control index is higher" when N rounds to 0.00. Below it are the exact API value with `+` or U+2212, at least 4 dp (`index_headline.go:56-68`, `index-headline.ts:21,31`), the label `teams[0] − teams[1]` in API order, and the chip "model estimate, uncalibrated". Sources: ADR 0026, #38. Tests: `index_headline_test.go`, `index-headline.test.mjs`, `hero-browser.mjs`.
2. **"Score unavailable".** This was "Score not recorded". It reuses the glossary term in `docs/LOCALE-REVIEW.md:58` and matches the existing `aria-label`, which `summary_test.go:57` asserts. The hero renders it at `match.html:103`. Sources: ADR 0026, #38.
3. **Mobile header.** It uses two 44px rows: brand and Scenarios, then audience and language (`controls.css:85-91`; ADR 0026:67). Checked by `hero-browser.mjs:262`.
4. **No-tracking copy.** "This replay has none" is wrong. Corner has tracking, but `/api/metrics` returns `trackingMetrics: "unsupported"` because of 8000 ms frame gaps (`docs/metrics.md:25,383`; reason string at `app/internal/metrics/compute.go:95`). The copy must say the tracking has a gap. It must not say the tracking is absent.

### 3.3 Motion moments

| Trigger | Motion | Duration / ease | Reduced motion |
|---|---|---|---|
| Moment becomes active (`#moment-banner` unhidden) | Lower third rises 8px and fades in; exits by fading | in `--dur-2` `--ease-out`; out 160ms `--ease-exit` | Opacity only, 120ms |
| Insight status settles (Waiting → Verified or Template) | Badge cross-fade, then the check icon stroke draws | 200ms + 320ms `--ease-out` | Instant swap |
| Evidence clip starts (`Replay evidence`) **Superseded: moved from D3b to D4a (C4)** | `#evidence-range-marker` grows from the clip start to its width; the active trail row tints as the clock passes it | 320ms `--ease-in-out`; tint 120ms | Marker appears at full width; tint stays |
| Moment selected while the pitch is off-screen | Scroll to `.pitch-shell` | Browser smooth scroll | `behavior:"auto"` (JS fix above) |
| Index difference sign flips (API tick) | 200ms background tint on the headline only. **No counting animation.** | `--dur-2` | None |

### 3.4 Constraint check

- **No new dependencies or CDN assets:** met. CSS and TS only, using the self-hosted Outfit and Plus Jakarta. `'Noto Sans Devanagari'` is a local-font fallback name and is never fetched.
- **Every number comes from the API:** C1 reuses `tick.teams[teams[0]].indexDelta`, the same source as `#metric-index-delta`. C4's "6 metric ticks" is `tickTimesMs.length`.
- **Canonical label:** the estimate chip text is exactly "model estimate, uncalibrated".
- **No prediction-like visuals:** watch C1. A two-colour diverging bar or a team gradient (as in the prototype hero) would read as a win meter, so the proposal is ~~**number only**~~ **Superseded: a sentence plus the exact signed value, label and chip, still with no bar, gradient or meter (note 1 under 3.2; #38 body: "The hero markup contains no share track, fill, gradient or meter element")**. The prototype's red pulsing "LIVE" is dropped.
- **sw-KE / hi-IN:** C5 removes tab wrapping. The hi-IN line height on Devanagari should be checked; it uses a system font. No layout depends on string width.
- **Three renderers:** C2 and C7 are DOM overlays on `.pitch-shell`. The banner box is identical across renderers today (`*-12-banner-*`).
- **Dark mode:** activating it means removing `html:has(body.experience){color-scheme:light}` (`experience.css:4`). Pitch turf and stadium colours are renderer-owned and unchanged. That is why it gets its own PR (D2b). **Superseded: deferred until after judging. The rule is now at `experience.css:5`.**

## 4. PR plan (each about half a day)

Every PR needs before/after screenshots at **1440×900 and 390×844**, in **SVG, Three.js and PixiJS**, for **en-GB, sw-KE and hi-IN**. It must pass `./scripts/check.sh`, `homepage-`, `experience-`, `analytics-`, `controls-` and `library-browser.mjs`. It must not regress: the canonical label wherever it appears now, "Verified (recorded)" text, evt-03/04/05 evidence, 22 players, the Return to match button, no horizontal scroll, and focus rings on 39 of 39 tab stops.

1. **D2a: semantic tokens, light.** **Status: Done**, #36, merge `1276f61`. Add the `.experience` layer. Replace the 144 hex values in `experience.css` with roles, rename the team tokens, and override `--font-tabular`.
   - *Accept:* `experience.css` has 0 hex outside the turf and heat colours. **Status:** 13 remain, 11 of them turf, heat and map colours. The other two are the `html` background (outside `.experience` scope) and the renderer-owned player-tag `#ffe9a1` (#36 body).
   - *Accept:* all eight failing pairs from section 2 measure ≥4.5:1 (muted 6.02, team 5.12/5.05).
   - *Accept:* Inter is no longer loaded on `/`.
   - *Accept:* `/legacy` is pixel-identical.
2. **D2b: dark roles.** ~~Planned~~ **Superseded: Deferred until after judging** (team decision, 19 Oct; `experience.css:5` still forces light). Dark values, `data-theme`, and removal of the forced `color-scheme`.
   - *Accept:* the pairs in 3.1 measure as stated in both themes.
   - *Accept:* the turf, kits and lower third are unchanged in all three renderers.
3. **D3a: hero and first impression (C1).** **Status: Done**, #38, merge `1a9c473`. All four accepts are checked by `tests/integration/hero-browser.mjs:235-262` (#38 body: hero 6/6).
   - *Accept:* the index difference headline is the largest number above the fold, and its value equals `/api/metrics` at 3 fixed seek points.
   - *Accept:* the mobile pitch top is ≤360px.
   - *Accept:* header targets are ≥44px. **Status:** on mobile only. Desktop targets are still 28px (#38 body, "Known limits").
   - *Accept:* calm-midfield shows −0.4287 with "Bastion City − Aurora Vale" at the end.
4. **D3b: lower third, badges and transport targets (C2, C3).** **Status: Next.** No PR yet (`gh pr list --state all`).
   - *Accept:* one overlay shows on the pitch at 88:11 and on the corner end state.
   - *Accept:* the badge variants differ in icon and colour, and the text is unchanged.
   - *Accept:* the play, restart and speed buttons are ≥44px.
   - *Accept:* the motion rows in 3.3 hold with and without reduced motion. **Superseded:** row 3 (evidence clip) moves to D4a. D3b covers rows 1, 2, 4 and 5.
5. **D4a: Evidence trail and timeline (C4, C6).** **Status: Next**, after D3b. It also takes motion row 3 from 3.3.
   - *Accept:* evt-03/04/05 are first, in order, and the 6 ticks sit behind one disclosure.
   - *Accept:* `[data-source-tick]` still counts 6.
   - *Accept:* the pitch is visible while the clip plays at both viewports.
   - *Accept:* the description contrast is ≥4.5:1.
6. **D4b: states and drawer tabs (C5, C7).** **Status: Next**, after D3b. The C7 no-tracking copy follows note 4 under 3.2.
   - *Accept:* loading, error (block `/api/replay`), no-tracking (corner) and zero moments (calm) each show one panel in light tokens.
   - *Accept:* the renderer switch is not pressed before data arrives.
   - *Accept:* tabs fit on one row at 1440 in all three locales, and every tab is 44px tall on mobile.
   - *Accept:* the existing N/A and label assertions still pass.

## Appendix: measurement provenance (added 19 Oct)

- Every measurement in sections 1 and 2 was taken on origin/main `57dc69c`. The Scope and Caveats above say so; a first pass on `1b2c8b9` was superseded.
- The screenshots (`shots/`, `superseded-1b2c8b9/`), the `metrics-*.json` files and the capture `scripts/` are **not in the repo**. They stay with the design-direction review artifacts outside it. Paths in this document such as `desktop-02` or `scripts/probe3.json` point to those artifacts, not to repo files.
- Later line references in sections 2 and 3 (for example `experience.css:4`, `pitch.ts:590`) also describe `57dc69c`. Code has moved since then: the color-scheme rule is now `experience.css:5`, and #36 records the `scrollIntoView` calls at `pitch.ts:619,734,749`.
