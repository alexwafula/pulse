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

Routing these needs format keys with placeholders (player, clock, event ID, counts) rather than one key per string.

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
