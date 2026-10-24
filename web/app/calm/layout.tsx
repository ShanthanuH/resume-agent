import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import { SITE_URL } from "@/lib/config";
import { copy } from "@/lib/copy";
import "@/skins/calm/calm.css";

// Two typefaces. Instrument Serif for headings, the wordmark and big numbers;
// Manrope for everything else. next/font serves both from our own domain, so
// no visitor request goes to Google, and sets the CSS variables calm.css reads.
const serif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});
const sans = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), // turns relative image paths into full URLs
  // Other pages set a short title; the template adds the site name after it.
  title: { default: copy.calm_meta_title, template: `%s | ${copy.meta_title_suffix}` },
  description: copy.calm_meta_description,
  openGraph: {
    title: copy.calm_meta_title,
    description: copy.calm_meta_description,
    type: "website",
    siteName: copy.nav_brand,
  },
  // summary_large_image is the card X shows with the big picture on top.
  twitter: { card: "summary_large_image", title: copy.calm_meta_title, description: copy.calm_meta_description },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#EAF1F8" };

/** The calm skin's frame. Each screen draws its own nav and footer. */
export default function CalmLayout({ children }: LayoutProps<"/calm">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} antialiased`}>
      <body className="min-h-svh bg-page font-sans text-ink-900">
        {/* Hidden until a keyboard user presses Tab: jumps to the content. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink-900 focus:px-4 focus:py-3 focus:text-white"
        >
          {copy.skip_link}
        </a>
        <main id="content">{children}</main>
      </body>
    </html>
  );
}
