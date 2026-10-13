import type { Metadata } from "next";
import { SiteLink } from "@/components/SiteLink";
import { chapter, inkButton, page } from "@/components/ui";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.notfound_title };

/** Shown for any address that is not a page of this site (HTTP 404). */
export default function NotFound() {
  return (
    <section className="field-recorded">
      <div className={`${page} ${chapter} stagger flex min-h-[72svh] flex-col justify-end`}>
        <h1 className="head poster">{copy.notfound_title}</h1>
        <p className="lead mt-6 max-w-[34ch]">{copy.notfound_text}</p>
        <SiteLink href="/" className={`${inkButton} mt-10 self-start`}>
          {copy.notfound_home}
        </SiteLink>
      </div>
    </section>
  );
}
