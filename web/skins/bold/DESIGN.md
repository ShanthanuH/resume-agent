# The bold skin of SwooshCV

The rules every screen is built against. The values live in
`web/skins/bold/bold.css` (the `@theme` block) and the repeated class lists in
`web/skins/bold/ui.ts`. Change a value there and every screen follows.

Direction: **Colour chapters** (taste-skill, seed 1715443601). See
`DESIGN_NOTES.md` for why.

## The idea

> On this site, the two versions of a resume line (the one you wrote and the
> one it became) become two flat colours. A changed word is lemon. Tap it and
> your own line opens under it on mint.

Every colour means one thing, on every screen. Nothing is coloured for
decoration.

## Colour

| Token | Value | Means | Used for |
| --- | --- | --- | --- |
| `ground` | `#000000` | the site | page background, header, footer |
| `tile` | `#1c1c1c` | a step up from the ground | filled tiles on black (FAQ, job post box, steps list) |
| `ink` | `#ffffff` | text on black | all running text on the ground |
| `muted` | `#a3a3a3` | secondary notes on black only | clock, file size, small notes (8.6:1 on black) |
| `sheet` | `#ffffff` | **the resume** | the resume, and the box the resume goes into |
| `changed` | `#f3ea7a` lemon | **a word that changed** | highlights, the second line of the headline, the wait screen |
| `yours` | `#9ae187` mint | **the line you wrote** | the original line under a changed one, privacy |
| `left-out` | `#fbb65c` orange | **left out, or went wrong** | "Not on your resume", field problems, error screens |
| `action` | `#93f1f7` cyan | **press this** | every main button, the open FAQ tile, the closing chapter |
| `recorded` | `#b9c8ff` cornflower | **not your data** | the recorded-run band, "How it works", limit and pause screens |

Rules:

- Text on a colour field or on the sheet is always pure black. Text on the
  ground is white. Grey (`muted`) is only for small secondary notes on black.
- Fields are flat and meet on a hard edge. No gradients, no tints, no shadows,
  no hairlines. Two things are told apart by a change of field, or by space.
- Lowest contrast in use: black on orange 11.6:1, `muted` on black 8.6:1.
  All pass WCAG AAA for text.

## Type

One family: **Jost** (400, 500, 700), served from our own domain by
`next/font`. No second face, no italics, no monospace.

| Step | Size | Set as | Used for |
| --- | --- | --- | --- |
| display | 10.2% of the page width, at most 8.5rem | 700, uppercase, tracking -0.03em, leading 0.9 | the home headline only: its longer line always fits on one line |
| poster | `clamp(2rem, 8.4vw, 7.5rem)` | as head | the one title of a screen that is only a title: the form, a notice, the 404 page |
| head | `clamp(2rem, 1.3rem + 3.2vw, 4rem)` | 700, uppercase, tracking -0.03em, leading 0.95 | page and chapter titles (short ones) |
| statement | `clamp(1.5rem, 1.1rem + 1.9vw, 2.75rem)` | 700, sentence case, tracking -0.02em, leading 1.05 | full-sentence headings: the wait, the demo's resume lines |
| lead | `clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem)` | 500, leading 1.3 | the sentence under a title, the result summary |
| body | `clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)` | 400, leading 1.5 | running text (17 to 19 px) |
| small | `clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem)` | 500 | notes, labels (never under 13 px) |

Rules: every heading fits in two lines at every width. Labels are sentence
case; no tiny spaced-out capitals. Numbers that change (the clock) use tabular
figures.

## Spacing

- Base unit 4 px. Steps in use: 4, 8, 12, 16, 24, 40, 64, 96.
- Page margins: 16 px on a phone, 40 px from 640 px up. Content is at most
  1360 px wide. Every chapter's text starts on the same left edge.
- A chapter's top and bottom padding: `clamp(3.5rem, 9vw, 8rem)`. Chapters
  touch: no gap and no divider between two fields.
- Inside a chapter: 24 px between a title and its text, 40 px before a control.
- Tap targets are at least 48 px tall.

## Radius

**0.** Every corner on the site is square: buttons, fields, tiles, highlights,
focus rings. One decision, no exceptions.

## Motion

- One easing: `cubic-bezier(0.16, 1, 0.3, 1)` (fast start, soft landing).
- Durations: 120 ms press, 240 ms a panel opening, 500 ms an entrance (things that come in on page load move but do not fade),
  900 ms the home headline.
- **Signature move:** each line of the home headline rises from behind its own
  baseline on load, the second 110 ms after the first.
- The highlight lands: its colour comes in behind the words (300 ms), one
  changed line after the other. Then the original line opens under it on mint
  (240 ms).
- Parts of a chapter rise 28 px as they scroll into view, one after the other. The blocks of the name in the footer rise the same way.
  This is CSS only (`animation-timeline: view()`); a browser without it shows
  everything in place.
- Buttons move 2 px down when pressed. Colour fields never fade into each
  other.
- Only `transform`, `opacity`, `background-color` (the highlight) and `grid-template-rows` are
  animated.
- `prefers-reduced-motion`: every animation and transition is cut to nothing;
  the content is the same.

## Components

- **Button:** a flat cyan rectangle with black text, 52 px tall, weight 500.
  On a cyan or other colour field it is black with white text. A second choice
  next to it is a text link with a thick underline, never an outlined button.
- **Link:** underlined, 2 px, in the text's own colour.
- **Focus:** a 3 px solid ring, 3 px away, white on black and black on colour.
- **Highlight (`mark`):** lemon, square, black text. While its line is open
  (or the mouse is over it) it has a 3 px black bar under it, and the original
  line shows on a mint field below.
- **Field:** a filled block, no border. The resume box is white (it is the
  sheet); the job post box is a `tile`. A problem turns the note under it
  orange and puts a 4 px orange bar on the box's left edge.
- **Progress:** five solid blocks, 12 px tall. Done is ink, current has a block
  moving through it, the rest are 25% ink.
- **Chapter:** a full-width flat field with the shared inner width. Class
  `field-*` sets its colour, its ink and its focus-ring colour together.

## Per screen

| Screen | Fields, top to bottom |
| --- | --- |
| Home | black (headline in two inks; on wide screens the top of the real PDF) → white (the resume, running, tappable) → cornflower / black split (how it works, a slider) → orange band (what the run refused to add) → black (does it work, privacy) → black (questions as tiles) → cyan (start) → black (the name, built from blocks) |
| Form | black, with the white resume box and the cyan button |
| Wait | cornflower band (recorded run) → lemon field with the sentence |
| Result | black summary → white resume → black: download, orange "not on your resume" |
| Error | orange field |
| Limit, pause | cornflower field |
| Privacy | mint title field → black sections |
| 404, crash | cornflower, orange |
| Link preview | black, the two-ink headline, one resume line on white with lemon |
