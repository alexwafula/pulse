# I18N backlog: attribute and tooltip strings

These strings are not routed through `t()` yet. They are `aria-label`, `title` and `placeholder` attributes, so they are read by screen readers and shown as tooltips but are not visible page text.

Source: the hi-IN scan in the 2026-10-16 locale review (`review-artifacts/verify-pr24-25-2026-10-16/VERIFY-PR24-25.md`, item 3, raw list `03-untranslated-hi.txt`), taken at `ce435e2`. It found 245 hardcoded strings: 30 visible text strings and 215 attribute strings.

- The 30 visible strings now go through the catalog. The Oct 18 readiness branch replaces the English placeholders with Kiswahili/Hindi drafts, including the later Evidence/moment labels and pressure narration. Native-speaker approval is still pending; catalog routing is not linguistic review. `tests/integration/locale-browser.mjs` checks routing and `locale-catalog.test.mjs` checks keys/placeholders.
- The 215 attribute strings below were deliberately left unchanged. Strings are verbatim from the scan, so some contain Hindi fragments produced by already-translated event sentences. Player and team names are fictional.
- Two changes since the scan: the Legacy link title is now `Open the original view` (the link is hidden), and passing-node labels now say `1 pass sent` instead of `1 passes sent`.

Visible text beyond the review's 30: a stricter scan also selects Control-swing and Set-piece moments and found 10 more visible Evidence-trail and moment-state strings. They are now routed the same way. One visible string is still not translated:

| String | Where | Why it is not routed |
|---|---|---|
| `frame gap of 8000 ms at 1628000; 5 Hz tracking (200 ms) is required` (and other `reason` values) | `#metrics-state` in the Control pane, for replays without supported tracking | It is the raw `reason` field from `/api/metrics`. Metric data is not translated, and translating it needs reason codes from the API. |

Since D4b-1 (ADR 0032) the experience shows a keyed line instead (`state.trackingGap`, or `state.trackingUnsupported` for other reasons) and keeps the raw `reason` inside a closed `<details>`, marked `data-no-translate`. `/legacy` still shows the raw reason.

Routing these needs format keys with placeholders (player, clock, event ID, counts) rather than one key per string.

## D3a Hero: Draft Translations (2026-10-20)

These keys were added with the hero. Their sw-KE and hi-IN values now have translated drafts, checked for placeholder preservation and English fallback. Native-language review is still required.

| Key | en-GB | sw-KE | hi-IN |
|---|---|---|---|
| `index.higher` | `{team}'s control index is {value} higher` | DRAFT | DRAFT |
| `index.level` | `Neither team's control index is higher` | DRAFT | DRAFT |
| `Score unavailable` | `Score unavailable` (literal key; also the existing `aria-label`) | DRAFT | DRAFT |

Keep `{team}` and `{value}`. The sentence must stay a plain comparison of two model numbers: no "winning", "ahead" or "likely".

## D3b Badges: Draft Translations (2026-10-20)

Added with the status badges. The sw-KE and hi-IN tooltip values now have translated drafts, not completed human review.

| Key | en-GB | sw-KE | hi-IN |
|---|---|---|---|
| `content-checked recording` | `content-checked recording` (literal key; the `title` tooltip on the "Verified (recorded)" badge) | DRAFT | DRAFT |

The tooltip describes what was checked, a recording. A translation must not name a model or say that a model verified anything.

## D4a Evidence Trail: Draft Translations (2026-10-20)

Added with the evidence-trail rail. The sw-KE and hi-IN values now have translated drafts in `locales.json`; native-language review remains pending for these new strings.

| Key | en-GB | sw-KE | hi-IN |
|---|---|---|---|
| `evidence.ticks` | `{count} metric ticks {start}–{end}` (plural; for example "6 metric ticks 88:09–88:11") | DRAFT | DRAFT |
| `evidence.tickOne` | `{count} metric tick {clock}` (singular, used only when `count` is 1; for example "1 metric tick 88:22") | DRAFT | DRAFT |
| `Evidence trail shown under the pitch` | `Evidence trail shown under the pitch` (literal key; the Evidence tab's note while a clip plays) | DRAFT | DRAFT |

Keep `{count}`, `{start}`, `{end}` and `{clock}`. The count and times come from the API's `tickTimesMs`. The en dash between the times is part of the format. The label sits next to the chip "model estimate, uncalibrated", which is already translated. A translation must call these samples of model metrics, not facts, events or predictions.

## Agent Inspector Advisory Labels: Draft Translations (2026-10-20)

Added so a named model's role output never reads as that model having verified a claim. The sw-KE and hi-IN values now have translated drafts; neither is certified as human reviewed.

| Key | en-GB | sw-KE | hi-IN |
|---|---|---|---|
| `Role outputs are advisory. Go recomputes every fact and decides publication.` | literal key; note under the Inspector's reference run | DRAFT | DRAFT |
| `Advisory verdict` | literal key; the Verifier record's term for its output | DRAFT | DRAFT |

A translation must keep the model's output advisory and say that Go, not the model, decides publication.

## Open-play insight templates: NEEDS HUMAN REVIEW (sw-KE, 2026-10-19)

The open-play pass-count insight (ADR 0031) is a template in Go (`app/internal/ai/open_play.go`) and Python (`agents/src/pulse_agents/patterns.py`), not a catalog key. Its sw-KE text now agrees with the count: singular when the count is 1, plural otherwise. Both forms are drafts written without a native speaker and need review. The en-GB sentences are unchanged, because the recorded capture is bound to them.

| Persona | Count | sw-KE | Status |
|---|---|---|---|
| CASUAL | 1 | `Pasi 1 iliyokamilika ilitangulia shuti la kwanza katika kipindi hiki cha mchezo wazi.` | NEEDS HUMAN REVIEW |
| CASUAL | 2 or more | `Pasi {count} zilizokamilika zilitangulia shuti la kwanza katika kipindi hiki cha mchezo wazi.` | NEEDS HUMAN REVIEW |
| ANALYST | 1 | `Kipindi cha mchezo wazi: pasi 1 iliyokamilika kabla ya shuti lake la kwanza.` | NEEDS HUMAN REVIEW |
| ANALYST | 2 or more | `Kipindi cha mchezo wazi: pasi {count} zilizokamilika kabla ya shuti lake la kwanza.` | NEEDS HUMAN REVIEW |

## Open-play insight templates: NEEDS HUMAN REVIEW (hi-IN, 2026-10-20)

The hi-IN CASUAL verb now agrees with the count: `दर्ज हुआ` when the count is 1 (late-siege), `दर्ज हुए` otherwise. ANALYST has no verb and is unchanged. Both forms are drafts written without a native speaker and need review. en-GB is unchanged.

| Persona | Count | hi-IN | Status |
|---|---|---|---|
| CASUAL | 1 | `इस खुले खेल की अवधि में पहले शॉट से पहले 1 सफल पास दर्ज हुआ।` | NEEDS HUMAN REVIEW |
| CASUAL | 2 or more | `इस खुले खेल की अवधि में पहले शॉट से पहले {count} सफल पास दर्ज हुए।` | NEEDS HUMAN REVIEW |
| ANALYST | any | `खुले खेल की अवधि: पहले शॉट से पहले {count} सफल पास।` | NEEDS HUMAN REVIEW |

## D4b-1 States: Draft Translations (2026-10-20)

Added with the default focus and C7 states (ADR 0032). All keys in the following two tables now have sw-KE and hi-IN drafts in `locales.json`, preserving placeholders and absence/estimate meaning. DRAFT means **NEEDS HUMAN REVIEW**, not a completed language sign-off.

| Key | en-GB | sw-KE | hi-IN |
|---|---|---|---|
| `state.noneInSequence` | `{name} has no passes, carries or shots in this sequence` (`{name}` is a team or a player) | DRAFT | DRAFT |
| `state.teamNoPassesYet` | `{team}: no completed passes yet` | DRAFT | DRAFT |
| `state.teamNoRoutesYet` | `{team}: no completed passes, carries or shots yet` | DRAFT | DRAFT |
| `state.idlePlayers` | `{count} players with no passes` (plural) | DRAFT | DRAFT |
| `state.idlePlayer` | `{count} player with no passes` (singular, used only when `count` is 1) | DRAFT | DRAFT |
| `state.playerNoneYet` | `{player}: no passes, carries or shots yet` | DRAFT | DRAFT |
| `state.windowNone` | `{team}: no completed passes, carries or shots from {start} to {end}` | DRAFT | DRAFT |
| `state.zeroRows` | `{count} metrics with none in either window` (plural) | DRAFT | DRAFT |
| `state.zeroRow` | `{count} metric with none in either window` (singular) | DRAFT | DRAFT |
| `state.trackingGap` | `Control metrics unavailable: tracking has a gap of {seconds} s at {clock}` | DRAFT | DRAFT |
| `state.trackingUnsupported` | `Control metrics unavailable: this replay's tracking does not support them` | DRAFT | DRAFT |
| `No passes yet` | `No passes yet` (literal key) | DRAFT | DRAFT |
| `No box entries or shots yet` | `No box entries or shots yet` (literal key) | DRAFT | DRAFT |
| `No box entries yet` | `No box entries yet` (literal key) | DRAFT | DRAFT |
| `No passes, shots or box entries yet` | `No passes, shots or box entries yet` (literal key) | DRAFT | DRAFT |
| `None yet` | `None yet` (literal key) | DRAFT | DRAFT |
| `No completed passes or carries yet` | `No completed passes or carries yet` (literal key) | DRAFT | DRAFT |
| `Details` | `Details` (literal key; the summary of the raw-reason disclosure) | DRAFT | DRAFT |

These existing visible strings were not in the catalog. `Loading moments` now renders as a keyed state line; the three map strings are unchanged in place and are added so the catalog covers them. All carry the same English placeholders:

| Key | sw-KE | hi-IN |
|---|---|---|
| `Loading moments` (literal key) | DRAFT | DRAFT |
| `No completed passes for this team yet.` (literal key) | DRAFT | DRAFT |
| `No shot attempts for this team yet.` (literal key) | DRAFT | DRAFT |
| `No tracking time accumulated yet.` (literal key) | DRAFT | DRAFT |

18 new keys. `state.noneInSequence` replaced `state.teamNone` and `state.playerNone`, which had the same en-GB text; the plural pairs stay separate, as `evidence.ticks`/`evidence.tickOne` do, because the catalog has no plural rules.

Keep `{name}`, `{team}`, `{player}`, `{count}`, `{start}`, `{end}`, `{seconds}` and `{clock}`. Each line states that something is absent; a translation must not say a team defended well, lost, or is losing. `{seconds}` is one decimal place; `{clock}` is `mm:ss`. The tracking-gap line explains why model metrics are missing; the untranslated API `reason` stays in the disclosure.
## D4b-2 Integration (2026-10-20)

The drawer reuses D4b-1's `state.noneInSequence` and `state.teamNoPassesYet`, so
`No players with completed passes yet` is removed from all catalogs. `/legacy`
retains the existing `No completed passes yet` line. `Metric evidence` and
`Route evidence` are removed with the duplicate Insights links.

The passing-node `aria-label` counts in the summary below come from the 2026-10-16 scan. Players with no completed pass sent or received are no longer drawn, so the live count is lower.

## D4b-2 drawer and passing network (2026-10-20): no new keys

The drawer Passing pane uses the D4b-1 states above for a team with nothing to draw: `state.noneInSequence` when the team has no pass, carry or shot in the sequence, and `state.teamNoPassesYet` when it has none yet. Its idle-player line (`state.idlePlayer`/`state.idlePlayers`) is unchanged. `/legacy` keeps `No completed passes yet`.

Removed with the Insights `.analytics-links` row, which no other view used: `Metric evidence` and `Route evidence` (sw-KE and hi-IN; en-GB had no entries).

The passing-node `aria-label` counts in the summary below come from the 2026-10-16 scan. The drawer graph now draws only players with a completed pass sent or received, so the live count is lower.


## Summary

| Pattern | Count |
|---|---|
| Passing-node labels `<player> (number N): … sent, … received` | 42 |
| Event buttons `Jump to mm:ss: …` | 27 |
| Pass evidence `Show events at …` / `Show events for …` | 12 |
| Pass evidence `Inspect pass evt-…` | 10 |
| Evidence cards `Inspect evt-… at …` | 7 |
| Moment buttons `Replay <moment> at …` | 4 |
| Lane meters and bars `<Lane> lane: …` (Routes pane and Insights) | 72 |
| One-off labels and tooltips | 41 |
| **Total** | **215** |

## Passing-node labels `<player> (number N): … sent, … received` (42)

| String | Element@attribute |
|---|---|
| `Mina (number 1): 0 passes sent, 0 received` | g@aria-label |
| `Bram (number 9): 0 passes sent, 0 received` | g@aria-label |
| `Theo (number 10): 0 passes sent, 0 received` | g@aria-label |
| `Juma (number 2): 0 passes sent, 0 received` | g@aria-label |
| `Ari (number 4): 0 passes sent, 0 received` | g@aria-label |
| `Sam (number 5): 0 passes sent, 0 received` | g@aria-label |
| `Leo (number 3): 0 passes sent, 0 received` | g@aria-label |
| `Noah (number 7): 0 passes sent, 0 received` | g@aria-label |
| `Kian (number 6): 0 passes sent, 0 received` | g@aria-label |
| `Enzo (number 8): 0 passes sent, 0 received` | g@aria-label |
| `Luca (number 11): 0 passes sent, 0 received` | g@aria-label |
| `Nia (number 1): 0 passes sent, 0 received` | g@aria-label |
| `Dax (number 9): 0 passes sent, 0 received` | g@aria-label |
| `Kael (number 19): 0 passes sent, 0 received` | g@aria-label |
| `Kofi (number 2): 0 passes sent, 0 received` | g@aria-label |
| `Musa (number 4): 0 passes sent, 0 received` | g@aria-label |
| `Leni (number 5): 0 passes sent, 0 received` | g@aria-label |
| `Tariq (number 3): 0 passes sent, 0 received` | g@aria-label |
| `Zayd (number 7): 0 passes sent, 0 received` | g@aria-label |
| `Imani (number 8): 0 passes sent, 0 received` | g@aria-label |
| `Tayo (number 10): 0 passes sent, 0 received` | g@aria-label |
| `Malik (number 11): 0 passes sent, 0 received` | g@aria-label |
| `Leni (number 5): 1 passes sent, 0 received` | g@aria-label |
| `Tariq (number 3): 0 passes sent, 1 received` | g@aria-label |
| `Tariq (number 3): 1 passes sent, 1 received` | g@aria-label |
| `Tayo (number 10): 0 passes sent, 1 received` | g@aria-label |
| `Imani (number 8): 0 passes sent, 1 received` | g@aria-label |
| `Tayo (number 10): 1 passes sent, 1 received` | g@aria-label |
| `Kofi (number 2): 0 passes sent, 1 received` | g@aria-label |
| `Imani (number 8): 1 passes sent, 1 received` | g@aria-label |
| `Kofi (number 2): 1 passes sent, 1 received` | g@aria-label |
| `Zayd (number 7): 0 passes sent, 1 received` | g@aria-label |
| `Zayd (number 7): 1 passes sent, 1 received` | g@aria-label |
| `Imani (number 8): 1 passes sent, 2 received` | g@aria-label |
| `Dax (number 9): 0 passes sent, 1 received` | g@aria-label |
| `Imani (number 8): 2 passes sent, 2 received` | g@aria-label |
| `Dax (number 9): 1 passes sent, 1 received` | g@aria-label |
| `Tayo (number 10): 1 passes sent, 2 received` | g@aria-label |
| `Tayo (number 10): 2 passes sent, 2 received` | g@aria-label |
| `Malik (number 11): 0 passes sent, 1 received` | g@aria-label |
| `Dax (number 9): 2 passes sent, 1 received` | g@aria-label |
| `Kael (number 19): 0 passes sent, 1 received` | g@aria-label |

## Event buttons `Jump to mm:ss: …` (27)

| String | Element@attribute |
|---|---|
| `Jump to 88:05: Leni गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:06: Leni ने Tariq को पास दिया` | button@aria-label |
| `Jump to 88:08: Tariq गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:09: Tariq ने Tayo को पास दिया` | button@aria-label |
| `Jump to 88:11: Tayo गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:12: Tayo ने Imani को पास दिया` | button@aria-label |
| `Jump to 88:14: Imani गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:15: Imani ने Kofi को पास दिया` | button@aria-label |
| `Jump to 88:16: Kofi गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:18: Kofi ने Zayd को पास दिया` | button@aria-label |
| `Jump to 88:19: Zayd गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:20: Zayd ने Imani को पास दिया` | button@aria-label |
| `Jump to 88:22: Imani गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:23: Imani ने Dax को पास दिया` | button@aria-label |
| `Jump to 88:24: Dax गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:25: Dax ने Tayo को पास दिया` | button@aria-label |
| `Jump to 88:26: Tayo गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:28: Tayo ने Malik को पास दिया` | button@aria-label |
| `Jump to 88:30: Malik गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:31: Malik ने क्रॉस भेजा` | button@aria-label |
| `Jump to 88:33: Ari ने गेंद दूर की` | button@aria-label |
| `Jump to 88:39: Malik ने Dax की ओर कॉर्नर भेजा` | button@aria-label |
| `Jump to 88:41: Dax का शॉट रोका गया` | button@aria-label |
| `Jump to 88:42: Dax गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:43: Dax ने Kael को पास दिया` | button@aria-label |
| `Jump to 88:44: Kael गेंद ले जा रहे हैं` | button@aria-label |
| `Jump to 88:45: Kael का शॉट असफल रहा` | button@aria-label |

## Pass evidence `Show events at …` / `Show events for …` (12)

| String | Element@attribute |
|---|---|
| `Show events at 88:06` | button@aria-label |
| `Show events at 88:09` | button@aria-label |
| `Show events at 88:12` | button@aria-label |
| `Show events at 88:15` | button@aria-label |
| `Show events at 88:18` | button@aria-label |
| `Show events at 88:20` | button@aria-label |
| `Show events at 88:23` | button@aria-label |
| `Show events at 88:25` | button@aria-label |
| `Show events at 88:28` | button@aria-label |
| `Show events at 88:43` | button@aria-label |
| `Show events at 88:41` | button@aria-label |
| `Show events at 88:45` | button@aria-label |

## Pass evidence `Inspect pass evt-…` (10)

| String | Element@attribute |
|---|---|
| `Inspect pass evt-25` | button@title |
| `Inspect pass evt-16` | button@title |
| `Inspect pass evt-10` | button@title |
| `Inspect pass evt-02` | button@title |
| `Inspect pass evt-04` | button@title |
| `Inspect pass evt-12` | button@title |
| `Inspect pass evt-14` | button@title |
| `Inspect pass evt-08` | button@title |
| `Inspect pass evt-06` | button@title |
| `Inspect pass evt-18` | button@title |

## Evidence cards `Inspect evt-… at …` (7)

| String | Element@attribute |
|---|---|
| `Inspect evt-22 at 88:39` | button@aria-label |
| `Inspect evt-23 at 88:41` | button@aria-label |
| `Inspect evt-23` | button@title |
| `Inspect evt-24` | button@title |
| `Inspect evt-25` | button@title |
| `Inspect evt-26` | button@title |
| `Inspect evt-27` | button@title |

## Moment buttons `Replay <moment> at …` (4)

| String | Element@attribute |
|---|---|
| `Replay Sustained pressure at 88:11` | button@aria-label |
| `Replay Control swing at 88:22` | button@aria-label |
| `Replay Control swing at 88:33` | button@aria-label |
| `Replay Set-piece shot at 88:41` | button@aria-label |

## Lane meters and bars `<Lane> lane: …` (Routes pane and Insights) (72)

| String | Element@attribute |
|---|---|
| `Left lane: 0 of 0 completed actions` | meter@aria-label |
| `Centre lane: 0 of 0 completed actions` | meter@aria-label |
| `Right lane: 0 of 0 completed actions` | meter@aria-label |
| `Left lane: 0 of 1 completed actions` | meter@aria-label |
| `Centre lane: 1 of 1 completed actions` | meter@aria-label |
| `Right lane: 0 of 1 completed actions` | meter@aria-label |
| `Left lane: 0 of 2 completed actions` | meter@aria-label |
| `Centre lane: 1 of 2 completed actions` | meter@aria-label |
| `Right lane: 1 of 2 completed actions` | meter@aria-label |
| `Left lane: 0 of 3 completed actions` | meter@aria-label |
| `Centre lane: 1 of 3 completed actions` | meter@aria-label |
| `Right lane: 2 of 3 completed actions` | meter@aria-label |
| `Left lane: 0 of 4 completed actions` | meter@aria-label |
| `Centre lane: 2 of 4 completed actions` | meter@aria-label |
| `Right lane: 2 of 4 completed actions` | meter@aria-label |
| `Left lane: 0 of 5 completed actions` | meter@aria-label |
| `Centre lane: 3 of 5 completed actions` | meter@aria-label |
| `Right lane: 2 of 5 completed actions` | meter@aria-label |
| `Left lane: 0 of 6 completed actions` | meter@aria-label |
| `Centre lane: 4 of 6 completed actions` | meter@aria-label |
| `Right lane: 2 of 6 completed actions` | meter@aria-label |
| `Left lane: 0 of 7 completed actions` | meter@aria-label |
| `Centre lane: 5 of 7 completed actions` | meter@aria-label |
| `Right lane: 2 of 7 completed actions` | meter@aria-label |
| `Left lane: 1 of 8 completed actions` | meter@aria-label |
| `Centre lane: 5 of 8 completed actions` | meter@aria-label |
| `Right lane: 2 of 8 completed actions` | meter@aria-label |
| `Left lane: 2 of 9 completed actions` | meter@aria-label |
| `Centre lane: 5 of 9 completed actions` | meter@aria-label |
| `Right lane: 2 of 9 completed actions` | meter@aria-label |
| `Left lane: 3 of 10 completed actions` | meter@aria-label |
| `Centre lane: 5 of 10 completed actions` | meter@aria-label |
| `Right lane: 2 of 10 completed actions` | meter@aria-label |
| `Left lane: 4 of 11 completed actions` | meter@aria-label |
| `Centre lane: 5 of 11 completed actions` | meter@aria-label |
| `Right lane: 2 of 11 completed actions` | meter@aria-label |
| `Left lane: 4 of 12 completed actions` | meter@aria-label |
| `Centre lane: 6 of 12 completed actions` | meter@aria-label |
| `Right lane: 2 of 12 completed actions` | meter@aria-label |
| `Left lane: 4 of 13 completed actions` | meter@aria-label |
| `Centre lane: 7 of 13 completed actions` | meter@aria-label |
| `Right lane: 2 of 13 completed actions` | meter@aria-label |
| `Left lane: 4 of 14 completed actions` | meter@aria-label |
| `Centre lane: 8 of 14 completed actions` | meter@aria-label |
| `Right lane: 2 of 14 completed actions` | meter@aria-label |
| `Left lane: 4 of 15 completed actions` | meter@aria-label |
| `Centre lane: 9 of 15 completed actions` | meter@aria-label |
| `Right lane: 2 of 15 completed actions` | meter@aria-label |
| `Left lane: 4 of 16 completed actions` | meter@aria-label |
| `Centre lane: 10 of 16 completed actions` | meter@aria-label |
| `Right lane: 2 of 16 completed actions` | meter@aria-label |
| `Left lane: 4 of 17 completed actions` | meter@aria-label |
| `Centre lane: 10 of 17 completed actions` | meter@aria-label |
| `Right lane: 3 of 17 completed actions` | meter@aria-label |
| `Left lane: 4 of 18 completed actions` | meter@aria-label |
| `Centre lane: 10 of 18 completed actions` | meter@aria-label |
| `Right lane: 4 of 18 completed actions` | meter@aria-label |
| `Left lane: 4 of 19 completed actions` | meter@aria-label |
| `Centre lane: 10 of 19 completed actions` | meter@aria-label |
| `Right lane: 5 of 19 completed actions` | meter@aria-label |
| `Left lane: 4 of 20 completed actions` | meter@aria-label |
| `Centre lane: 11 of 20 completed actions` | meter@aria-label |
| `Right lane: 5 of 20 completed actions` | meter@aria-label |
| `Left lane: 4 of 21 completed actions` | meter@aria-label |
| `Centre lane: 12 of 21 completed actions` | meter@aria-label |
| `Right lane: 5 of 21 completed actions` | meter@aria-label |
| `Left lane: 4 of 22 completed actions` | meter@aria-label |
| `Centre lane: 13 of 22 completed actions` | meter@aria-label |
| `Right lane: 5 of 22 completed actions` | meter@aria-label |
| `Left lane: 0 completed passes and carries` | progress@aria-label |
| `Centre lane: 0 completed passes and carries` | progress@aria-label |
| `Right lane: 0 completed passes and carries` | progress@aria-label |

## One-off labels and tooltips (41)

| String | Element@attribute |
|---|---|
| `Open the legacy dashboard` | a@title |
| `Match clock` | div@aria-label |
| `Score not recorded` | span@aria-label |
| `Match scoreboard and pass share` | section@aria-label |
| `Score unavailable` | span@aria-label |
| `Score is not recorded in this replay` | span@title |
| `Completed passes share` | div@aria-label |
| `Match sequence metrics` | aside@aria-label |
| `Pitch view` | div@aria-label |
| `Three.js stadium view` | button@title |
| `PixiJS tactical view` | button@title |
| `Original SVG view` | button@title |
| `Toggle the model-estimated pitch control field` | label@title |
| `Pitch control overlay` | #control-toggle@aria-label |
| `Animated football pitch showing the fictional match` | #pitch@aria-label |
| `Reset 3D camera angle` | #camera-reset@aria-label |
| `Toggle pitch fullscreen` | #fullscreen-button@aria-label, #fullscreen-button@title |
| `Playback speed` | div@aria-label |
| `Story, charts and maps` | #experience-panel@aria-label |
| `Story view` | div@aria-label |
| `Story player` | select@aria-label, span@aria-label |
| `Insight view` | div@aria-label |
| `Map team` | select@aria-label, span@aria-label |
| `Pitch map` | div@aria-label, section@aria-label |
| `Retry panel` | #panel-retry@aria-label |
| `Analysis tabs` | div@aria-label |
| `Bastion City directed passing network` | svg@aria-label |
| `Aurora Vale directed passing network` | svg@aria-label |
| `Tracking-derived reach estimate, not a count of pressure events` | dt@title |
| `Completed pass/carry entries followed by a same-phase shot within 12 seconds, before anoth` | dt@title |
| `साक्ष्य / evt-22` | button@title |
| `साक्ष्य / evt-23` | button@title |
| `Completed passes: Bastion City 0, Aurora Vale 10, up to 89:20` | canvas@aria-label, svg@aria-label |
| `Shot attempts: Bastion City 0, Aurora Vale 2, up to 89:20` | canvas@aria-label, svg@aria-label |
| `Box entries: Bastion City 0, Aurora Vale 1, up to 89:20` | canvas@aria-label, svg@aria-label |
| `Bastion City tracking occupancy heatmap up to 89:20` | canvas@aria-label, svg@aria-label |
| `Late siege starting positions` | svg@aria-label |
| `Calm midfield starting positions` | svg@aria-label |
| `Central entry starting positions` | svg@aria-label |
| `Corner chance starting positions` | svg@aria-label |
| `Passing exchange starting positions` | svg@aria-label |

## Pre-freeze polish: direction and kind casing (2026-10-20)

No keys were added. Experience pages now show direction, outcome and Story event kinds in sentence case from existing keys:

| Key | Change | Used by |
|---|---|---|
| `LEFT`, `RIGHT` | New en-GB values `left`/`right`; sw-KE `KUSHOTO`/`KULIA` lowercased to `kushoto`/`kulia` (casing only); hi-IN unchanged | Hero direction (`team.direction`) and the Pitch maps direction line. The pitch stamp upper-cases the value, so it reads as before; `/legacy` upper-cases it too and is unchanged |
| `Pass`, `Carry`, `Shot`, `Cross`, `Corner`, `Clearance` | Unchanged; Story now uses them instead of the enum keys (`PASS` …) | Story event kinds, as in the Live timeline |
| `complete`, `incomplete`, `blocked` | Unchanged; the Live selected action now uses them instead of `COMPLETE` … on experience pages | `#detail-description` |

