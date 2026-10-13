import type { Metadata } from "next";
import { Flow } from "@/components/flow/Flow";
import { page } from "@/components/ui";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.flow_meta_title,
  description: copy.flow_meta_description,
};

/** The product: drop your resume, paste the job post, press one button. */
export default function TryPage() {
  return (
    <div className={`${page} pt-6 sm:pt-12`}>
      <Flow variant="try" />
    </div>
  );
}
