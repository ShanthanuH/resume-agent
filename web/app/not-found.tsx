import type { Metadata } from "next";
import { SiteLink } from "@/components/SiteLink";
import { page, primaryButton } from "@/components/ui";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.notfound_title };

/** Shown for any address that is not a page of this site (HTTP 404). */
export default function NotFound() {
  return (
    <div className={`${page} pt-10 sm:pt-20`}>
      <div className="max-w-xl">
        <h1 className="display text-[2.6rem] sm:text-[3.5rem]">{copy.notfound_title}</h1>
        <p className="mt-4 text-lg text-soft">{copy.notfound_text}</p>
        <SiteLink href="/" className={`${primaryButton} mt-8`}>
          {copy.notfound_home}
        </SiteLink>
      </div>
    </div>
  );
}
