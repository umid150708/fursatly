# Clipping cards — closed frames for listing stories

**Date:** 2026-09-29 · **Status:** approved (option B of three: ruled page, clipping box, tinted slab)

## Problem
Readers couldn't tell where one listing ended and the next began. A story was held
together only by a heavy top rule and a hairline over the footer, so the date row
floated in the 40px gap and read as part of the story below. Nothing ran between the
columns either.

## Design
- `EventCard` becomes a clipping: 1px frame in `foreground/45` on `bg-card`, square
  corners, `hover:border-foreground`. The heavy top rule is gone, because the frame
  replaces it.
- The footer (deadline + days left / funding) is a band inside the frame:
  `border-t border-border bg-muted/50`, full-bleed to the frame edges.
- Grids that hold `EventCard` (category grid, front-page secondary, saved items) go from
  `gap-x-8 gap-y-10` to `gap-4 md:gap-5`, since closed frames need less air.
- Echoes the taped clippings in the hero (`FloatingCards`), minus the tape and shadow.

## Out of scope
Card content, kicker colours, typography.
