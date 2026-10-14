import type { Metadata } from "next";
import { Flow } from "@/skins/calm/flow/Flow";
import { SiteLink } from "@/components/SiteLink";
import { ArrowDot } from "@/skins/calm/primitives";
import { page, primaryButton, section } from "@/skins/calm/ui";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.example_meta_title,
  description: copy.example_meta_description,
};

/**
 * "Watch a real run": one real run on a made-up resume, played back through
 * the same screens a live run uses, at its real speed. It calls no server and
 * no model, so it always works, also when the day's live runs are gone.
 */
export default function ExamplePage() {
  return (
    <>
      <Flow variant="example" />
      <section aria-labelledby="yours" className="bg-mist">
        <div className={`${page} ${section} text-center`}>
          <h2 id="yours" className="t-title mx-auto max-w-[20ch]">
            {copy.example_cta_title}
          </h2>
          <SiteLink href="/try" className={`${primaryButton} mt-8`}>
            {copy.home_cta}
            <ArrowDot />
          </SiteLink>
        </div>
      </section>
    </>
  );
}
