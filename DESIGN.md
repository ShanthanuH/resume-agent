# DESIGN.md: the calm skin of SwooshCV

The default look. The values live in `web/skins/calm/calm.css` (`@theme`
and the shared classes), the shared React pieces in `web/skins/calm/parts.tsx`,
and each screen's own styles next to it (`landing/landing.css`,
`result/result.css`, ...). The other skin, bold, is described in
`web/skins/bold/DESIGN.md`. Both skins share all logic and all words.

## The idea

A paper plane folded from a resume crosses a morning sky. Its dashed contrail
runs down the page and ends on a star in the sunset at the bottom. Every card
is frosted glass over that sky. The page shows the promise instead of saying
it: a changed phrase in yellow, your own line under it in green, and the skills
you lack crossed out in red.

## Colour

| Token | Value | Used for |
| --- | --- | --- |
| `ink-900` | `#0B2340` | main text, ink buttons |
| `ink-700` | `#1D3A5C` | body text |
| `ink-500` | `#46617F` | muted text and hints |
| `page` | `#EAF1F8` | page background |
| `paper-text` | `#1A1F29` | text on the white resume page |
| `mark` | `#FFE45C` | **only** changed text |
| `before-bg` / `before-text` | `rgba(46,125,50,.10)` / `#1E5E24` | **only** the "Before" box |
| `strike` | `#C8432F` | **only** the line through a missing skill |

The day gradient (`.day`) runs from `#EAF1F8` to `#5F89C0` behind the landing
sections and the plain pages. Errors use ink text in a glass card, never red.

## Type

- **Instrument Serif** 400, normal and italic: headings, the wordmark, big numbers.
- **Manrope** 400 to 700: everything else.

Both come from `next/font`, served from our own domain. Inputs are 16 px or
more on phones, so iOS does not zoom.

## Parts

| Class or component | What it is |
| --- | --- |
| `.glass` (`<Glass>`) | frosted glass with a top-left highlight; `tone="photo"` blurs a little more, for the running and result screens |
| `.ink` | the dark button |
| `.field` | inputs inside glass |
| `.lift` | a 1 px hover lift for glass buttons and cards |
| `<Struck>` | a missing skill with a hand-drawn red line, each at its own angle |
| `<Switch>` | `<button role="switch">`, 52 × 30, with a 44 px tap area |
| `<Before>`, `<Mark>` | the green original line and the yellow change |

Browsers with no backdrop filter get a nearly solid white glass.

## Layout

- The landing page switches to its desktop layout above 860 px (`wide:`), the
  result screen above 1000 px (`desk:`).
- The hero form, the running card and the notices sit in the same place, so
  the form seems to turn into the progress card.
- The closing photo is placed so the star lands at the end of the contrail at
  every width (the numbers are in `landing/landing.css` and `Closing.tsx`).

## Motion

Only these move: the drifting clouds (desktop), the strikes drawing in as the
section scrolls into view, the star's glow, the plane bobbing on the progress
bar, the current step's pulse, hover lifts and the FAQ chevron. Nothing fades
in on scroll. `prefers-reduced-motion: reduce` stops all of it, and the strikes
then show fully drawn.

## Performance

The sections under the hero are drawn on the server; only the parts that
respond to a tap ship as code. The running and result screens load when they
are needed. The hero photo is preloaded for each breakpoint; the closing photo
loads lazily.
