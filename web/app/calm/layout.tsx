import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SITE_URL } from "@/lib/config";
import { copy } from "@/lib/copy";
import { Footer } from "@/skins/calm/Footer";
import { Header } from "@/skins/calm/Header";
import "@/skins/calm/calm.css";

// One typeface: Geist, a clean grotesk close to the system faces of Apple
// devices. next/font serves it from our own domain, so no visitor request
// goes to Google. It sets the CSS variable calm.css reads.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], weight: ["400", "500", "600"] });

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

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

/** The calm skin's frame: a floating header, the page, the footer. */
export default function CalmLayout({ children }: LayoutProps<"/calm">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        {/* Hidden until a keyboard user presses Tab: jumps past the header. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-3 focus:text-white"
        >
          {copy.skip_link}
        </a>
        <Header />
        <main id="content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
