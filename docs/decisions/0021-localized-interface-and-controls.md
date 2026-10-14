# 0021: Localized interface, template audiences and Select2 lifecycle

## Scope and approval

Alex requested Select2 controls, non-overlapping layouts, working personas and
English/Kiswahili/Hindi, then explicitly approved interface and template
translation. Hindi is represented as `hi-IN`. No deployment or paid model call
is part of this local UI iteration on main.

## Controls

Use locally bundled Select2 4.0.13/jQuery 3.7.1 with typed integration, retaining
the project's Node 20 toolchain. Search reads current translated option labels;
native change events still reach the existing TypeScript/HTMX controllers.
Only one menu opens at a time. Menus fit their control/viewport, close on outside
interaction or Escape, and do not disappear due to search focus or mobile
keyboard height changes. See [Select2 dropdowns](https://select2.org/dropdown/)
and [events](https://select2.org/programmatic-control/events/).

Panel requests/swaps are deferred while a menu is open. Select2 initialization
is idempotent and cleanup checks the actual widget instance, not a CSS class.
Persona handlers match buttons only, never page/panel containers. Header controls
and tabs wrap on narrow screens; language has a separate slot from personas.

## Languages and evidence

The structured UI catalog is shared by the browser and Go source-event panels.
Player/team names, IDs, numbers, coordinates and metric calculations do not change.
Both Go and Python templates have canonical locale/persona-specific wording,
tested against six shared examples. The opt-in Hindi locale extends the existing
v2 enums/models together; no fields or evidence rules change. Existing English
requests remain compatible. Invalid/short/case-mismatched locales are rejected.

Kiswahili/Hindi wording remains a translation draft pending native-speaker review.
It always ships as `FALLBACK_TEMPLATE`, preserving complete fact/event references.
Both publishing policies reject non-English model prose; the service returns
translated templates before allocating any model call or request budget.

Persona/locale preferences persist in URL/local storage. Changes refresh paused
panels explicitly and retain the common clock and normal playback. Analyst adds
source IDs/phase/coordinates; Casual remains concise. Source recap downloads use
the displayed localized recap when available.

## Checks

Go/Python shared locale tests cover canonical output, tampering, evidence,
unsupported locales and rejection of unreviewed model publication. Browser
checks cover real Select2 search, both personas and languages, persistence,
menu stability and non-overlapping controls at 320/390/768/1440px. Existing full
experience, homepage pixel, analytics and core checks remain required.
