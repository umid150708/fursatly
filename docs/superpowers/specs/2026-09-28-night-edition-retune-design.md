# Night edition retune — calmer dark mode

Date: 2026-09-28
Status: approved

## Goal

Make the dark "night edition" easier to read and scan without touching the
Gazette layout or the light edition. The operator reported that in dark mode
the front page is hard to navigate: **everything blurs together**, and it is
**tiring to look at**. Search reachability and link affordance were offered as
causes and ruled out by the operator.

## What was measured (live fursatly.uz, dark, 1440×900)

Page background resolves to `rgb(20,18,16)` (`--bg-dark: 30 10% 7%`).

- **Text contrast is not the problem.** The dimmest text on the page
  ("International", "Germany · English") is ~7.7:1 and headlines are 14.6:1.
  Brightening text would make it worse, not better.
- **Glare.** Headlines use `--foreground: 40 25% 88%` — near-white cream at
  14.6:1, set in heavy display weight at very large sizes (the lead headline,
  the countdown numeral). Large areas of bright letterform on near-black.
- **Shimmer.** `.dark .paper-grain` is `opacity: 0.08; mix-blend-mode: screen`.
  On a dark ground, *screen* lightens the grain specks across the whole page.
- **No grouping.** 55 hairlines use `--border: 30 6% 22%` at **1.61:1**, below
  the 3:1 WCAG 1.4.11 floor for graphics needed to understand content. They are
  what separates one story or column from the next, so the three front-page
  columns read as one mass.
- **A rainbow.** Nine category hues sit at 60–78% lightness and up to 85%
  saturation, plus vermilion and gold — about eleven competing colours against
  the Gazette's stated "one spot colour". When everything is coloured, colour
  stops carrying meaning.

The light edition's hairlines are also faint (1.44:1) — see Out of scope.

## Design

All changes are in `src/app/globals.css`: the `.dark {}` block and the single
`.dark .paper-grain` rule. Ratios are against `--bg-dark`.

| Token | Now | Proposed | Why |
|---|---|---|---|
| `--foreground` | `40 25% 88%` · 14.63:1 | `40 16% 79%` · 11.74:1 | Less glare on display type |
| `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--primary` | `40 25% 88%` | `40 16% 79%` | Kept in step with `--foreground` |
| `--border` | `30 6% 22%` · 1.61:1 | `30 6% 38%` · 3.06:1 | Dividers group content (meets 3:1) |
| `--cat-scholarships` | `212 70% 72%` | `212 32% 70%` · 8.48:1 | Calm the rainbow |
| `--cat-competitions` | `10 85% 70%` | `10 38% 70%` · 8.09:1 | 〃 |
| `--cat-summer-programs` | `30 85% 66%` | `30 38% 66%` · 8.44:1 | 〃 |
| `--cat-research` | `262 65% 78%` | `262 28% 76%` · 9.24:1 | 〃 |
| `--cat-volunteer` | `150 45% 60%` | `150 26% 62%` · 8.28:1 | 〃 |
| `--cat-stem` | `188 60% 60%` | `188 30% 62%` · 8.14:1 | 〃 |
| `--cat-workshops` | `334 70% 74%` | `334 30% 72%` · 8.42:1 | 〃 |
| `.dark .paper-grain` opacity | `0.08` | `0.035` | Stop the shimmer; blend mode unchanged |

The table is the complete list of changes: any `.dark` token not in it keeps
its current value.

**Unchanged on purpose:** `--accent` (vermilion — the one spot colour),
`--gold` ("Fully Funded" is meaningful), `--muted-foreground` (7.72:1, still a
clear step below the new foreground's 11.74:1, so hierarchy holds),
`--cat-internships` and `--cat-other` (already low-saturation), and everything
outside `.dark`.

## Trade-offs

- **`--border` is global in dark mode.** Inputs, cards, dialogs and the
  deadline-forecast rows get the stronger line too, not just story dividers.
  Accepted: it is consistent, and all of them benefited in the live preview.
- **Category hues are calmed, not removed.** A single ink tone for all category
  labels would be the strict newspaper reading of "one spot colour". Rejected
  for now: distinct hues still help scanning, and each label already names its
  category in text.
- **Modest by design.** This fixes glare and grouping. It does not change
  density — three columns of equal-weight headlines is a layout matter.

## Out of scope

- Front-page hierarchy (demoting side-rail headlines, column spacing) and a
  two-column layout. Revisit only if the page still blurs after this ships.
- Light edition hairlines (`--border` at 1.44:1). Same defect, different theme;
  deliberately left for a separate change so this one stays dark-only.
- Search disappearing once you scroll past the hero, and links with no at-rest
  affordance. Real, measured, but not what the operator reported as the problem.

## Acceptance

1. `tests/category-taxonomy.test.mjs` passes — every `--cat-*` stays ≥ 4.5:1
   in both themes (the proposed dark values are 7.61–9.24:1).
2. Full suite passes.
3. Live check in dark on the front page and an event page: dividers visible
   between rail items, category labels calm, headlines softer, no shimmer.
4. Light edition renders identically to before.
