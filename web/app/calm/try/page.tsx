import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { Flow } from "@/skins/calm/flow/Flow";

export const metadata: Metadata = {
  title: copy.flow_meta_title,
  description: copy.flow_meta_description,
};

/** The product: drop your resume, paste the job post, press one button. */
export default function TryPage() {
  return <Flow variant="try" />;
}
