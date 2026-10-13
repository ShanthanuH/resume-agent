import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { copy } from "@/lib/copy";
import { diffWords } from "@/lib/diff";
import { EXAMPLE_RUN } from "@/lib/example";

// The picture X, LinkedIn and chat apps show when someone shares the site.
// Next.js draws it once, at build time, from the JSX below. Its words come
// from content/copy.yaml, so it follows the copy without anyone redrawing it.
//
// It is the home page's first screen made small: the headline in two inks on
// black, and under it one line of the resume on white with its changed words
// in lemon. Large flat shapes, so it still reads at thumbnail size.

export const alt = copy.og_alt;
export const size = { width: 1200, height: 630 }; // the size every platform expects
export const contentType = "image/png";

// The colours of app/globals.css. The image library cannot read CSS variables.
const GROUND = "#000000";
const INK = "#ffffff";
const SHEET = "#ffffff";
const CHANGED = "#f3ea7a";

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

// The first rewritten line of the recorded run: the product, shown not described.
const bullet = EXAMPLE_RUN.result.bullets[0];
const original = bullet?.replaces ? (EXAMPLE_RUN.result.evidence[bullet.replaces] ?? "") : "";
const pieces = bullet ? diffWords(original, bullet.text) : [];

export default async function Image() {
  const [medium, bold] = await Promise.all([font("Jost-500.ttf"), font("Jost-700.ttf")]);
  return new ImageResponse(
    (
      // This library lays out with flexbox only, and every element that has
      // more than one child must say display: flex.
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: GROUND,
          color: INK,
          fontFamily: "Jost",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", padding: "44px 56px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 700 }}>
            <span style={{ textTransform: "uppercase", letterSpacing: -1 }}>{copy.nav_brand}</span>
            <span style={{ fontWeight: 500 }}>{copy.og_line}</span>
          </div>
          {/* Two sentences, one per line, the second in lemon. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 30,
              fontSize: 126,
              fontWeight: 700,
              lineHeight: 0.92,
              letterSpacing: -4,
              textTransform: "uppercase",
            }}
          >
            <span>{copy.og_title_1}</span>
            <span style={{ color: CHANGED }}>{copy.og_title_2}</span>
          </div>
        </div>

        {/* A piece of the resume, edge to edge: one line with its changed words in lemon. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            background: SHEET,
            color: GROUND,
            padding: "30px 56px 34px",
            fontSize: 37,
            fontWeight: 500,
            lineHeight: 1.36,
          }}
        >
          {/* Words are laid out one by one, because a highlight in the middle
              of a wrapping sentence is not something this library can do. */}
          {pieces.flatMap((piece, p) =>
            piece.text.split(" ").map((word, w) => (
              <span
                key={`${p}-${w}`}
                style={{
                  background: piece.changed ? CHANGED : "transparent",
                  // The gap after a word is padding, so that a highlight
                  // runs on unbroken from one changed word to the next.
                  paddingRight: 10,
                  // A highlight starts a little before its first letter.
                  // The negative margin keeps that letter where it was.
                  paddingLeft: w === 0 && piece.changed ? 6 : 0,
                  marginLeft: w === 0 && piece.changed ? -6 : 0,
                }}
              >
                {word}
              </span>
            )),
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jost", data: medium, weight: 500, style: "normal" },
        { name: "Jost", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
