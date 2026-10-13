import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { HeaderAction } from "@/components/HeaderAction";
import { SiteLink } from "@/components/SiteLink";
import { page, quietLink } from "@/components/ui";
import { GITHUB_URL, SITE_URL } from "@/lib/config";
import { copy } from "@/lib/copy";
import "./globals.css";

// The pairing: Fraunces, a soft old-style serif, for headlines, and Hanken
// Grotesk, a quiet sans, for everything else. next/font serves both from our
// own domain, so no visitor request goes to Google. Each sets a CSS variable
// used in globals.css.
//
// Fraunces comes from two small files in assets/fonts: its display drawing
// (optical size 72), cut down to the Latin letters the headlines use. Together
// they are 38 KB. The full font from Google with the same look is 150 KB, and
// a phone on a slow network has to wait for it before it can show the headline.
const display = localFont({
  variable: "--font-fraunces",
  src: [
    { path: "../assets/fonts/Fraunces-72pt-Regular.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/Fraunces-72pt-Italic.woff2", weight: "400", style: "italic" },
  ],
  // Until the font arrives the headline is shown in Times, stretched to the
  // same size, so the text does not jump when Fraunces replaces it.
  adjustFontFallback: "Times New Roman",
});
const sans = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), // turns relative image paths into full URLs
  // Other pages set a short title; the template adds the site name after it.
  title: { default: copy.meta_title, template: `%s | ${copy.meta_title_suffix}` },
  description: copy.meta_description,
  openGraph: {
    title: copy.meta_title,
    description: copy.meta_description,
    type: "website",
    siteName: copy.nav_brand,
  },
  // summary_large_image is the card X shows with the big picture on top.
  twitter: { card: "summary_large_image", title: copy.meta_title, description: copy.meta_description },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbfaf6" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Hidden until a keyboard user presses Tab: jumps past the header. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-paper"
        >
          {copy.skip_link}
        </a>
        <header className={`${page} flex items-center justify-between py-4`}>
          <SiteLink
            href="/"
            aria-label={copy.nav_home_label}
            className="display flex min-h-11 items-center text-[1.4rem]"
          >
            {/* The stroke under the name is the product's highlight. */}
            <span className="logo-mark">{copy.nav_brand}</span>
          </SiteLink>
          <HeaderAction />
        </header>
        <main id="content" className="flex-1">
          {children}
        </main>
        <footer className="mt-24 border-t border-rule">
          <div className={`${page} flex flex-wrap items-center gap-x-6 gap-y-1 py-6 text-sm text-soft`}>
            <span className="display mr-auto text-base text-ink">{copy.nav_brand}</span>
            <SiteLink href="/example" className={quietLink}>
              {copy.footer_example}
            </SiteLink>
            <SiteLink href="/privacy" className={quietLink}>
              {copy.footer_privacy}
            </SiteLink>
            <a href={GITHUB_URL} className={quietLink}>
              {copy.footer_github}
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
