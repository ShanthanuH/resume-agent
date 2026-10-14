import type { Metadata } from "next";
import { Flow } from "@/skins/calm/flow/Flow";
import { ExampleNote } from "@/skins/calm/pages/ExampleNote";
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
  return <Flow variant="example" note={<ExampleNote />} />;
}
