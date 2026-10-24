"use client";

import { useSitePath } from "@/components/useSitePath";
import { copy } from "@/lib/copy";
import { SiteLink } from "@/components/SiteLink";
import { quietLink, smallButton } from "./ui";

/**
 * The right side of the header: two plain links and the button that leads to
 * the flow. The button is left out on the flow page (it would lead to the page
 * you are on) and on the home page (the same button is the first thing there).
 * On a phone only one link is shown, so the bar stays one line.
 */
export function HeaderAction() {
  const path = useSitePath();
  const withButton = path !== "/try" && path !== "/";
  return (
    <nav className="small flex items-center gap-x-6">
      <SiteLink href="/example" className={`${quietLink} max-sm:hidden`}>
        {copy.footer_example}
      </SiteLink>
      <SiteLink href="/privacy" className={`${quietLink} ${withButton ? "max-sm:hidden" : ""}`}>
        {copy.footer_privacy}
      </SiteLink>
      {withButton && (
        <SiteLink href="/try" className={smallButton}>
          {copy.nav_try}
        </SiteLink>
      )}
    </nav>
  );
}
