import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { copy } from "@/lib/copy";
import { diffWords } from "@/lib/diff";
import { EXAMPLE_RUN } from "@/lib/example";

// The picture X, LinkedIn and chat apps show when someone shares the site.
// Next.js draws it once, at build time, from the JSX below. Its words come
// from content/copy.yaml, so it follows the copy without anyone redrawing it.

export const alt = copy.og_alt;
export const size = { width: 1200, height: 630 }; // the size every platform expects
export const contentType = "image/png";

// The colours of app/globals.css. The image library cannot read CSS variables.
const PAPER = "#f8f4ea";
const SHEET = "#fffefb";
const INK = "#10261f";
const SOFT = "#4c5249";
const RULE = "#e0d9c6";
const MARK = "#ffe27a";

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

// The first rewritten line of the recorded run: the product, shown not described.
const bullet = EXAMPLE_RUN.result.bullets[0];
const original = bullet?.replaces ? (EXAMPLE_RUN.result.evidence[bullet.replaces] ?? "") : "";
const pieces = bullet ? diffWords(original, bullet.text) : [];

export default async function Image() {
  const [regular, italic, sans] = await Promise.all([
    font("Fraunces-72pt-Regular.ttf"),
    font("Fraunces-72pt-Italic.ttf"),
    font("HankenGrotesk-Regular.ttf"),
  ]);
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
          padding: "56px 72px",
          background: PAPER,
          color: INK,
          fontFamily: "Hanken",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* The name, with the highlighter stroke under it. */}
          <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 34 }}>
            <span style={{ backgroundImage: `linear-gradient(transparent 62%, ${MARK} 62%)`, padding: "0 4px" }}>
              {copy.nav_brand}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 34,
              fontFamily: "Fraunces",
              fontSize: 82,
              lineHeight: 1.04,
              letterSpacing: -2,
            }}
          >
            <span>{copy.og_title_1}</span>
            <span style={{ fontStyle: "italic" }}>{copy.og_title_2}</span>
          </div>
        </div>

        {/* A piece of the resume: one line with its changed words highlighted. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: SHEET,
            border: `1px solid ${RULE}`,
            borderRadius: 10,
            padding: "22px 28px",
            fontSize: 25,
            lineHeight: 1.45,
          }}
        >
          {/* Words are laid out one by one, because a highlight in the middle
              of a wrapping sentence is not something this library can do. */}
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {pieces.flatMap((piece, p) =>
              piece.text.split(" ").map((word, w) => (
                <span
                  key={`${p}-${w}`}
                  style={{
                    background: piece.changed ? MARK : "transparent",
                    // The gap after a word is padding, so that a highlight
                    // runs on unbroken from one changed word to the next.
                    paddingRight: 7,
                    // A highlight starts a little before its first letter.
                    // The negative margin keeps that letter where it was.
                    paddingLeft: w === 0 && piece.changed ? 5 : 0,
                    marginLeft: w === 0 && piece.changed ? -5 : 0,
                  }}
                >
                  {word}
                </span>
              )),
            )}
          </div>
          <div style={{ display: "flex", marginTop: 12, color: SOFT, fontSize: 20 }}>{copy.og_line}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: regular, weight: 400, style: "normal" },
        { name: "Fraunces", data: italic, weight: 400, style: "italic" },
        { name: "Hanken", data: sans, weight: 400, style: "normal" },
      ],
    },
  );
}
