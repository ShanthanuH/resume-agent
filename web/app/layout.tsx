import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import Link from "next/link";
import { GITHUB_URL, PROMISE, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/config";
import "./globals.css";

// next/font downloads these at build time and serves them from our own domain,
// so no visitor request goes to Google. Each sets a CSS variable used in globals.css.
const sans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const serif = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), // turns relative image paths into full URLs
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: PROMISE,
  openGraph: { title: SITE_TITLE, description: PROMISE, type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: PROMISE },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#faf7f0" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-rule">
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
              {SITE_NAME}
              {/* The mark is a citation chip: the product's identity in one glyph. */}
              <sup className="ml-0.5 font-mono text-[0.6em] font-medium text-accent">[1]</sup>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              {/* The example is the main path: live runs are limited to a few a day. */}
              <Link href="/try" className="py-2 underline-offset-4 hover:underline">
                Try it
              </Link>
              <Link href="/example" className="rounded-md bg-ink px-3 py-2 font-medium text-paper hover:bg-accent">
                Example
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-rule">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted sm:px-6">
            <span>{SITE_NAME}</span>
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              Privacy
            </Link>
            <a href={GITHUB_URL} className="underline-offset-4 hover:underline">
              GitHub
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
