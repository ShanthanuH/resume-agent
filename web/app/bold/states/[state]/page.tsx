import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StateDemo } from "@/skins/bold/StateDemo";
import { REPLAY_ONLY } from "@/lib/config";
import { copy } from "@/lib/copy";
import { STATE_NAMES, type StateName } from "@/lib/states";

export const metadata: Metadata = { title: copy.states_meta_title, robots: { index: false, follow: false } };

// Build one page per state name, and answer 404 for any other name.
export const dynamicParams = false;
export function generateStaticParams() {
  return STATE_NAMES.map((state) => ({ state }));
}

/** The flow, opened in one state. Preview builds only: see ../page.tsx. */
export default async function StatePage({ params }: PageProps<"/bold/states/[state]">) {
  if (!REPLAY_ONLY) notFound();
  const { state } = await params;
  return <StateDemo name={state as StateName} />;
}
