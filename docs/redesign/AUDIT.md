# Audit of the site before the redesign

Made with the `redesign-existing-projects` skill on the paper + serif design
(commit `0b02f49`). The pictures it is based on are in `docs/redesign/before/`:
every page and state at 390 and 1440 px (25 shots, 50 files).

What already works and is kept: every flow and state, replay mode, the copy
file and its check, focus handling, the reduced-motion rule, 48 px tap targets,
no sideways scroll, real 404 and error pages, a skip link, the link-preview
image drawn from the copy.

## Problems

### The idea

1. **The signature is small.** The one thing only this product does (tap a
   changed word, see your own line) happens inside a 13 px demo card and an
   indented grey block. Nothing on the page is built around it.
2. **It looks like its category.** Cream paper, an old-style serif, a yellow
   highlighter and a sheet of paper with a soft shadow is the default look of
   resume and writing tools. A visitor from X cannot tell it from the others
   in a thumbnail.
3. **"Nothing invented" is said, not shown.** The promise is a sentence under
   the headline. The layout does not show two things side by side: what you
   wrote and what it became.

### Type

4. The serif headline is light (weight 400) and thin on a phone: it has no
   weight next to the dark button under it.
5. Three numerals in grey italics for "How it works" are decoration, and they
   take a third of a phone screen for nine words.
6. Small capital labels with wide tracking are used for five different things
   (demo label, section titles, "your original line", resume sections, the PDF
   tag), so none of them stands out.
7. The clock and file size are in the proportional body font; only tabular
   figures stop them from jiggling.

### Colour and surface

8. The top-right yellow glow is a soft radial gradient on every page: an
   ambient effect that means nothing.
9. One dark panel at the bottom of an otherwise cream page reads as a pasted-in
   block.
10. Four near-identical creams (paper, sheet, desk, rule) are hard to tell
    apart on a phone in daylight: the demo card and the page almost merge.
11. Shadows are long, soft and generic (`0 32px 64px -36px`).
12. The highlight is the same yellow at rest and when open, only slightly
    deeper: an open line is hard to pick out on the result page.

### Layout

13. Home at 1440: the hero leaves the left half empty under the button and the
    demo floats top-right; then three equal columns; then two equal columns;
    then a narrow FAQ with an empty right half. Every section is a different
    grid with no shared edge.
14. Home at 390: 2,800 px tall, of which about 900 px is empty space between
    one-line sections.
15. Result at 390: the resume is one long sheet; the changed lines are at
    scroll positions 650 and 820, below the first screen, so the first thing a
    visitor sees after a run is their unchanged name and education.
16. Result at 1440: the original line pushes the resume down when it opens, so
    the text you were reading moves.
17. The wait screen is a headline and a 6 px bar in the top third of an
    otherwise empty page. The most interesting thing the product does (checking
    each line against the resume) is hidden behind "Show steps".
18. Notices (error, limit, paused) are a headline and a button, left-aligned in
    a centred column, with nothing that ties them to the product.
19. The same 10 px radius is on every button, box and field; the demo card
    (16 px) and the closing panel (24 px) are the only exceptions.

### Components

20. The FAQ is the standard accordion with plus signs.
21. "Not on your resume" is a row of pill chips.
22. The recorded-run label is a pill badge.
23. Filled button plus outline button is the only button pairing.
24. The dashed drop box is the standard upload control.
25. Links are underlined in the hairline colour, so on cream they look like
    plain text until pointed at (weak on touch, where there is no hover).

### Motion

26. Everything uses one short rise-and-fade. The trace opening, the signature
    gesture, moves the same way as a FAQ answer.
27. The progress bar's sweep is the only thing alive on the wait screen.

### Link preview

28. The preview image is cream with small serif text: at X's thumbnail size the
    highlighted line cannot be read and the image has no shape that says what
    the product is.
