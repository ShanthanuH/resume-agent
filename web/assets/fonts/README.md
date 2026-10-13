# Fonts kept in the repo

Two weights of Jost, the site's one typeface, from Google Fonts. Jost is
licensed under the SIL Open Font License 1.1, which allows shipping it with a
project.

| File | Used by | What it is |
| --- | --- | --- |
| `Jost-500.ttf` | the link-preview image (`app/opengraph-image.tsx`) | Jost, weight 500 |
| `Jost-700.ttf` | the link-preview image | Jost, weight 700 |

The link-preview image is drawn at build time by a library that needs plain
`.ttf` files. The pages themselves get Jost from `next/font/google`
(`app/layout.tsx`), which downloads it at build time and serves it from our own
domain.

## Where the files came from

Google's font service hands out `.ttf` files to browsers that do not say they
understand newer formats:

    curl -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Jost:wght@700"

prints a small style sheet with the address of the `.ttf` file in it.
