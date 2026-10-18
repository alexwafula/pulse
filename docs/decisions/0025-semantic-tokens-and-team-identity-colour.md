# 0025: Semantic light tokens and team colour by identity

Date: 2026-10-18
Status: Implemented on review branch (D2a); teammate review pending

## Decision

`tokens.css` gains a semantic layer scoped to `.experience`: type scale, space,
radii, `--elev-1..3`, durations/easings and light colour roles (`--c-canvas`,
`--c-ink`, `--c-ink-muted`, `--c-accent`, `--c-team-a/b`, `--c-verified`,
`--c-template`, `--c-estimate`, `--c-error`, `--c-overlay` and tints). The
values are the light set from the 18 Oct design direction (section 3.1). No dark
values yet; `html:has(body.experience)` still forces `color-scheme: light`.
`experience.css` reads only these roles. Literal colours remain only for turf,
heat and renderer-owned colours, plus the `html` background, which sits outside
the `.experience` scope.

Team colour follows the team, not its position in `match.teams`.
`app/web/src/team-colour.ts` maps `vale` (Aurora Vale) to kit A (`--c-team-a`) and
`bastion` to kit B (`--c-team-b`). An unknown id takes the kit its opponent does not wear, or its position when neither id is known.
At start-up `pitch.ts` points the positional `--team-home`/`--team-away` slots
at those tokens. That recolours the crest, swatch, share bars, charts, maps,
mini score and SVG players. The SVG, PixiJS and Three.js presentations paint
kits and control overlays from the same colour.

The legacy raw tokens are renamed `--team-aurora*` to `--team-a*` and
`--team-bastion*` to `--team-b*`, with the same values. `/legacy` keeps its
positional palette and stays pixel-identical. Inter remains for `/legacy`;
`.experience` sets `--font-tabular: var(--font-ui)` with tabular figures, so `/`
no longer requests it.

## Consequences

Aurora Vale is the same colour in late-siege (listed second) and corner (listed
first). The mapping lives in presentation code because match metadata has no
team colour. Moving it into the contract would need a schema change and
agreement from both engineers. Under reduced motion, `scrollIntoView` uses
`behavior: "auto"`. `tests/integration/tokens-browser.mjs` checks team colour,
the audited contrast pairs, Inter requests, `/legacy` pixels and the scroll
behaviour.
