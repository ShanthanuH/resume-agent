import type { ReactNode } from "react";
import { SiteLink } from "@/components/SiteLink";
import { Wordmark } from "@/skins/calm/parts";
import { copy } from "@/lib/copy";

/**
 * The frame of the plain pages (privacy, 404, error, owner, states): the day
 * gradient at full height, the wordmark as a link home, and the content
 * centered under it.
 */
export function PageFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="day flex min-h-svh flex-col">
      <nav className="px-5 py-4 wide:px-[clamp(20px,4vw,56px)] wide:py-6">
        <SiteLink
          href="/"
          aria-label={copy.nav_home_label}
          className="inline-flex min-h-11 items-center rounded-lg"
        >
          <Wordmark className="text-[26px] leading-none wide:text-[30px]" />
        </SiteLink>
      </nav>
      <div className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 wide:pt-10">
        <div className={`w-full ${wide ? "max-w-[720px]" : "max-w-[560px]"}`}>{children}</div>
      </div>
    </div>
  );
}

/** The class of a dark button on these pages (links and buttons alike). */
export const inkButton =
  "ink inline-flex min-h-12 items-center justify-center rounded-full px-7 text-base font-semibold";
