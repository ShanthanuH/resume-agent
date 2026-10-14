"use client";

import { SiteLink } from "@/components/SiteLink";
import { useSitePath } from "@/components/useSitePath";
import { copy } from "@/lib/copy";

/**
 * A floating pill at the top of every page: the name, two links, and the way
 * to the flow. It sits over the page (over the sky on the home page) instead
 * of being glued to the top edge. The button is left out on the flow page (it
 * would lead to the page you are on) and on the home page (the card in the
 * sky is the way in). On a phone only one link is shown.
 */
export function Header() {
  const path = useSitePath();
  const withButton = path !== "/try" && path !== "/";
  return (
    <header className="absolute inset-x-0 top-0 z-20 px-3 pt-3 sm:pt-5">
      <div className="mx-auto flex max-w-[72rem] items-center justify-between gap-3 rounded-full bg-white/95 py-1.5 pl-5 pr-1.5 shadow-float ring-1 ring-white/60">
        <SiteLink href="/" aria-label={copy.nav_home_label} className="flex min-h-11 items-center text-[1.0625rem] font-semibold tracking-[-0.02em]">
          {copy.nav_brand}
        </SiteLink>
        <nav className="t-small flex items-center gap-x-1 sm:gap-x-2">
          <SiteLink href="/example" className="rounded-full px-3 py-2.5 text-ink-soft transition-colors hover:text-ink max-sm:hidden">
            {copy.footer_example}
          </SiteLink>
          <SiteLink
            href="/privacy"
            className={`rounded-full px-3 py-2.5 text-ink-soft transition-colors hover:text-ink ${withButton ? "max-sm:hidden" : ""}`}
          >
            {copy.footer_privacy}
          </SiteLink>
          {withButton && (
            <SiteLink
              href="/try"
              className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 font-medium text-white transition-transform duration-[160ms] ease-calm active:scale-[0.98]"
            >
              {copy.nav_try}
            </SiteLink>
          )}
        </nav>
      </div>
    </header>
  );
}
