import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { copy } from "@/lib/copy";

// The picture X, LinkedIn and chat apps show when someone shares the site.
// It is the home page's first screen: the sky photo with the headline in the
// empty sky on the right. The photo is a committed JPEG (public/hero/og-sky.jpg)
// because the image library cannot read WebP or AVIF.

export const alt = copy.og_alt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [photo, font] = await Promise.all([
    readFile(join(process.cwd(), "public/hero/og-sky.jpg")),
    // Geist ships inside next, as a TTF the image library can read.
    readFile(join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")),
  ]);
  const src = `data:image/jpeg;base64,${photo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Geist", color: "#ffffff" }}>
        <img src={src} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630 }} />
        {/* A soft navy wash behind the words, so white stays readable on the light sky. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 620,
            height: 630,
            display: "flex",
            background: "linear-gradient(90deg, rgba(11,31,51,0) 0%, rgba(11,31,51,0.38) 100%)",
          }}
        />
        <div style={{ position: "absolute", top: 56, right: 64, display: "flex", fontSize: 30 }}>{copy.nav_brand}</div>
        <div
          style={{
            position: "absolute",
            top: 190,
            right: 64,
            width: 480,
            display: "flex",
            flexDirection: "column",
            fontSize: 88,
            lineHeight: 1.02,
            letterSpacing: -3,
          }}
        >
          {copy.calm_hero_title}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Geist", data: font, weight: 400, style: "normal" }] },
  );
}
