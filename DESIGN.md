# DESIGN.md: the calm skin of SwooshCV

The default look. The values live in `web/skins/calm/calm.css` (`@theme`
and `:root`), the repeated class lists in `web/skins/calm/ui.ts`, and the
shared pieces in `web/skins/calm/primitives.tsx`. Change a value there and
every calm screen follows. The other skin, bold, is described in
`web/skins/bold/DESIGN.md`. Both skins share all logic and all words.

Direction: taste-skill high-end-visual-design, "soft structuralism". White,
ink and sky. One full-bleed daylight photo at the top, then quiet white
pages with soft cards.

## The idea

> A resume page, folded into a paper airplane, rises above the clouds. The
> sky is empty on the right, and that is where you start: one line, and the
> box your resume goes into.

The promise is three things: it tailors your resume, it invents nothing, it
is free. The page proves the second one by showing it: a changed word in
yellow, your own line under it in green, and the skills you lack crossed out.

## Colour

All taken from the hero photo, except the two marks.

| Token | Value | Used for |
| --- | --- | --- |
| `ink` | `#0b1f33` | all text on white, the main button. 16.7:1 on white |
| `ink-soft` | `#4a5d72` | secondary text, captions. 6.8:1 on white |
| `paper` | `#ffffff` | page background, cards, the resume |
| `mist` | `#f4f8fc` | alternate section background (a cool, high sky) |
| `cloud` | `#fbf7f1` | the warm band (the lit cloud tops); used once or twice per page |
| `line` | `rgb(11 31 51 / 0.08)` | hairlines and card rings. Never a grey solid border |
| `sky` | `#3284ce` | decorative only: small dots, the progress fill. Never text on white |
| `sky-ink` | `#1a63b0` | links, focus rings, the selected state. 6.1:1 on white |
| `sky-wash` | `#e8f1fb` | a file being dragged in, a hovered row |
| `changed` | `#f3ea7a` | **only** a word the run changed (`<Mark>`) |
| `yours` | `#dcf3d6` + edge `#2f8a43` | **only** "your original line" (`<Original>`) |
| `problem` | `#b42318` | **only** the sentence under a field that has a problem |

Rules:

- Yellow means "changed", green means "your original line". Nothing else on
  the site is yellow or green: not buttons, not badges, not icons.
- What the job asks for and your resume lacks is shown crossed out
  (`<Strike>`), under the heading "Not on your resume, so we left them out".
  Not red, not orange: ink-soft with a line through it.
- Text over the photo is white. The hero puts a soft navy wash behind its
  text block (`.sky-scrim`), so small white text stays readable on the light
  part of the sky.
- No gradients except that one wash and the photo itself. No glow.

## Type

One family: **Geist** (sans), from `next/font`, served from our own domain.
Weights 400, 500 and 600. No Inter, Fraunces or Jost. Numbers that tick
(the clock) use `tabular-nums`.

| Class | Size | Weight / tracking | Used for |
| --- | --- | --- | --- |
| `.t-display` | clamp(2.75rem → 5.5rem) | 600, -0.04em, line 1.0 | the one hero line |
| `.t-title` | clamp(2rem → 3.25rem) | 600, -0.03em, line 1.08 | section and screen titles |
| `.t-heading` | clamp(1.25rem → 1.5rem) | 600, -0.015em | card titles, small headings |
| `.t-lead` | clamp(1.125rem → 1.3125rem) | 400, line 1.5 | the line under a title |
| `.t-body` | 1.0625rem | 400, line 1.6 | running text |
| `.t-small` | 0.875rem | 400 / 500 | captions, notes, labels |
| `.t-eyebrow` | 0.8125rem | 500, sentence case, in a pill | a small label above a title |

Rules: sentence case everywhere. **No all-caps headings, no letter-spaced
capitals.** Titles stay short: two lines at most on a phone. Line length for
running text is 60 to 68 characters (`max-w-[62ch]`).

## Spacing

A 4 px base. The page is calm because it is roomy.

- Page width: `max-w-[72rem]`, side padding 20 px (phone), 32 px (tablet+).
  Class: `page` in `ui.ts`.
- Between sections: `--section` = clamp(5rem → 9rem). Class: `section`.
- Inside a card: 24 px (phone), 32 px (desktop).
- Title to lead: 16 to 20 px. Lead to action: 32 px.
- The header floats over the page (it is not glued to the top), so a page
  without the hero starts with `pageTop` (enough room under the header).

## Radius

Rounded, concentric, never mixed with square corners.

| Token | Value | Used for |
| --- | --- | --- |
| `--radius-shell` | 28 px | outer shell of a card |
| `--radius-card` | 22 px | inner core of a card (28 minus the 6 px shell padding) |
| `--radius-field` | 16 px | text boxes, the drop box, the original-line panel |
| `--radius-mark` | 4 px | the yellow highlight |
| full | 9999 px | buttons, pills, the header |

## Shadow and depth

Cards use the "double bezel": a faint outer shell (`bg-ink/[0.03]`, ring
`line`, 6 px padding) holding a white core with its own soft shadow. Shadows
are wide and faint, tinted with ink, never black.

- `--shadow-soft`: `0 1px 2px rgb(11 31 51 / 0.04), 0 8px 24px -12px rgb(11 31 51 / 0.12)`. Cards on white.
- `--shadow-float`: `0 2px 4px rgb(11 31 51 / 0.05), 0 24px 60px -20px rgb(11 31 51 / 0.30)`. The hero card over the sky, the header pill.
- Over the photo, the hero card is `bg-white/85` with `backdrop-blur-xl`.
  That is the only blur on the site.

## Motion

One curve for everything: `--ease-calm: cubic-bezier(0.32, 0.72, 0, 1)`.

| Name | Duration | What moves |
| --- | --- | --- |
| press | 160 ms | buttons scale to 0.98 when pressed; the arrow in the button slides 2 px |
| open | 360 ms | the original line opening under a changed one (grid rows 0fr → 1fr) |
| enter | 700 ms | a block rising 16 px into place as it scrolls in (`.rise`) |
| highlight | 600 ms | the yellow sweeping in behind a changed word (`.sweep`) |

Rules:

- Only `transform`, `opacity` and grid-row height move. Never `top`, `left`,
  `width` or `height`.
- The hero line and the hero card do not fade in: the photo and the line are
  the largest paint, and a fade would delay it. They may move only.
- Scroll entrances use CSS `animation-timeline: view()` where supported, and
  nothing otherwise. No scroll listeners.
- `prefers-reduced-motion: reduce` turns every animation off.

## Components (primitives)

In `web/skins/calm/primitives.tsx` and `ui.ts`. Pages use these; they do not
restyle them.

- `primaryButton`: ink pill, white text, 48 px tall, with a trailing arrow
  in its own white-tinted circle (`<ArrowDot />`).
- `secondaryButton`: white pill, ink text, ring `line`.
- `textLink`: sky-ink, underlined 1 px, offset 4 px; offset grows on hover.
- `<Card>`: the double-bezel card. `tone="float"` for over the photo.
- `<Eyebrow>`: a small sentence-case pill label.
- `<Mark>`: a changed word, yellow.
- `<Original>`: your original line, green panel with a green left edge and
  the label "Your original line".
- `<Strike>`: a skill the job asks for and your resume lacks, crossed out.
- `<SkyPhoto>`: the hero photo, wide on desktop and tall on a phone, as AVIF
  with a WebP fallback, loaded first.

## Pages

1. Home: hero photo (headline + the upload card in the empty sky), then the
   trace demo (first section after the hero), crossed-out skills, how it
   works, FAQ, closing "Try it on your resume", footer.
2. Try: the same card, larger, on white; then the running state; then the
   result.
3. Result: the resume with marks, the trace (tap a mark to see your line),
   the crossed-out gaps, download.
4. Example, privacy, error, limit, paused, 404: plain white pages with one
   card.
