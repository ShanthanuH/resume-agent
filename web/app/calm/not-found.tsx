import type { Metadata } from "next";
import { SiteLink } from "@/components/SiteLink";
import { ArrowDot, Card } from "@/skins/calm/primitives";
import { page, pageTop, primaryButton } from "@/skins/calm/ui";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.notfound_title };

/** Shown for any address that is not a page of this site (HTTP 404). */
export default function NotFound() {
  return (
    <section className={`bg-mist ${pageTop}`}>
      <div className={`${page} pb-24 sm:pb-32`}>
        <Card className="mx-auto max-w-xl" coreClassName="p-7 sm:p-10">
          <h1 className="t-title">{copy.notfound_title}</h1>
          <p className="t-lead mt-5 text-ink-soft">{copy.notfound_text}</p>
          <SiteLink href="/" className={`${primaryButton} mt-8`}>
            {copy.notfound_home}
            <ArrowDot />
          </SiteLink>
        </Card>
      </div>
    </section>
  );
}
