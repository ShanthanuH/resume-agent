# Fonts kept in the repo

Fraunces (the headline font) and one weight of Hanken Grotesk, from Google
Fonts. Both families are licensed under the SIL Open Font License 1.1, which
allows shipping them with a project.

| File | Used by | What it is |
| --- | --- | --- |
| `Fraunces-72pt-Regular.woff2`, `Fraunces-72pt-Italic.woff2` | every page (`app/layout.tsx`) | Fraunces at optical size 72, weight 400, cut down to basic Latin |
| `Fraunces-72pt-Regular.ttf`, `Fraunces-72pt-Italic.ttf` | the link-preview image (`app/opengraph-image.tsx`) | the same drawing, uncut |
| `HankenGrotesk-Regular.ttf` | the link-preview image | Hanken Grotesk, weight 400 |

The link-preview image is drawn at build time by a library that needs plain
`.ttf` files. The pages get Hanken Grotesk from `next/font/google` instead.

## How the .woff2 files were made

The `.ttf` files are Google's static instances. The `.woff2` files are the same
fonts with only the characters English headlines need, compressed:

    uvx --from fonttools --with brotli pyftsubset Fraunces-72pt-Regular.ttf \
      --unicodes="U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2212" \
      --layout-features="*" --flavor=woff2 --output-file=Fraunces-72pt-Regular.woff2

(and the same for the italic). A headline with a character outside that list
still shows: the browser draws that one character in the fallback font.
