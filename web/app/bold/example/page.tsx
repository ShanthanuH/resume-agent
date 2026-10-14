import type { Metadata } from "next";
import { Flow } from "@/skins/bold/flow/Flow";
import { SiteLink } from "@/components/SiteLink";
import { chapter, inkButton, page } from "@/skins/bold/ui";
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
      {/* Cyan, the colour of the main action: the way from watching to doing. */}
      <section aria-labelledby="yours" className="field-action mt-[var(--chapter)]">
        <div className={`${page} ${chapter} arrive`}>
          <h2 id="yours" className="head">
            {copy.example_cta_title}
          </h2>
          <SiteLink href="/try" className={`${inkButton} mt-8`}>
            {copy.home_cta}
          </SiteLink>
        </div>
      </section>
    </>
  );
}
