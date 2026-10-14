import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { Flow } from "@/skins/calm/flow/Flow";

export const metadata: Metadata = {
  title: copy.flow_meta_title,
  description: copy.flow_meta_description,
};

/** The product on its own: the hero with the form, without the sections. */
export default function TryPage() {
  return <Flow variant="try" />;
}
