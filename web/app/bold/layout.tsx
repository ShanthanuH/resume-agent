import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import { BlockName } from "@/skins/bold/BlockName";
import { HeaderAction } from "@/skins/bold/HeaderAction";
import { SiteLink } from "@/components/SiteLink";
import { page, quietLink } from "@/skins/bold/ui";
import { GITHUB_URL, SITE_URL } from "@/lib/config";
import { copy } from "@/lib/copy";
import "@/skins/bold/bold.css";

// One typeface for everything: Jost, a geometric sans in the tradition of
// 1920s poster lettering. next/font serves it from our own domain, so no
// visitor request goes to Google. It sets a CSS variable used in globals.css.
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], weight: ["400", "500", "700"] });

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

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#000000" };

export default function RootLayout({ children }: LayoutProps<"/bold">) {
  return (
    <html lang="en" className={`${jost.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Hidden until a keyboard user presses Tab: jumps past the header. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-action focus:px-4 focus:py-3 focus:text-black"
        >
          {copy.skip_link}
        </a>
        {/* A plain bar: the name, two links, one action. */}
        <header className={`${page} flex items-center justify-between gap-4 py-3`}>
          <SiteLink
            href="/"
            aria-label={copy.nav_home_label}
            className="flex min-h-11 items-center text-xl font-bold uppercase tracking-[-0.03em]"
          >
            {copy.nav_brand}
          </SiteLink>
          <HeaderAction />
        </header>
        <main id="content" className="flex-1">
          {children}
        </main>
        {/* The close: the name built large from blocks of the site's colours. */}
        <footer className={`${page} pb-6 pt-[var(--chapter)]`}>
          <BlockName />
          <div className="small mt-8 flex flex-wrap items-center gap-x-8 gap-y-1">
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
