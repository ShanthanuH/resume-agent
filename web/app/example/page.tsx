import type { Metadata } from "next";
import { Flow } from "@/components/flow/Flow";
import { SiteLink } from "@/components/SiteLink";
import { page, primaryButton } from "@/components/ui";
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
    <div className={`${page} pt-6 sm:pt-12`}>
      <Flow variant="example" />
      <section aria-labelledby="yours" className="mt-20 border-t border-rule pt-14">
        <h2 id="yours" className="display text-[1.75rem] sm:text-[2.25rem]">
          {copy.example_cta_title}
        </h2>
        <SiteLink href="/try" className={`${primaryButton} mt-6`}>
          {copy.home_cta}
        </SiteLink>
      </section>
    </div>
  );
}
