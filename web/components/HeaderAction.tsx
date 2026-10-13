"use client";

import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy";
import { SiteLink } from "./SiteLink";
import { smallButton } from "./ui";

/**
 * The button at the top right of every page. It leads to the flow, so on the
 * flow page itself it is left out: two buttons with the same words, one of
 * which only reloads the page, would be confusing.
 */
export function HeaderAction() {
  const onFlow = usePathname() === "/try";
  if (onFlow) return null;
  return (
    <SiteLink href="/try" className={smallButton}>
      {copy.nav_try}
    </SiteLink>
  );
}
