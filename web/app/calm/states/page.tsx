import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { page } from "@/skins/calm/ui";
import { REPLAY_ONLY } from "@/lib/config";
import { copy } from "@/lib/copy";
import type { StateName } from "@/lib/states";

export const metadata: Metadata = { title: copy.states_meta_title, robots: { index: false, follow: false } };

// The label for each state, in the order a run would meet them.
const LABELS: [StateName | "empty", string][] = [
  ["empty", copy.states_empty],
  ["file-added", copy.states_file_added],
  ["bad-file-scan", copy.states_scan],
  ["bad-file-big", copy.states_big],
  ["running", copy.states_running],
  ["running-fast", copy.states_running_fast],
  ["done", copy.states_done],
  ["done-question", copy.states_questions],
  ["error", copy.states_error],
  ["limited", copy.states_limited],
  ["limited-visitor", copy.states_limited_visitor],
  ["paused", copy.states_paused],
];

/**
 * A list of every state of the flow, each one link away. It exists on preview
 * builds only, where no live run can start: there it is the way to see the
 * limit, pause and error screens. On the live site this address is a 404.
 */
export default function StatesPage() {
  if (!REPLAY_ONLY) notFound();
  return (
    <div className={`${page} grid gap-x-10 gap-y-8 pt-6 lg:grid-cols-12 lg:pt-14`}>
      <div className="lg:col-span-5">
        <h1 className="head">{copy.states_title}</h1>
        <p className="lead mt-6">{copy.states_lead}</p>
      </div>
      <ul className="space-y-1 lg:col-span-7">
        {LABELS.map(([name, label]) => (
          <li key={name}>
            {/* "empty" is simply the flow page itself. */}
            <Link
              href={name === "empty" ? "/try" : `/states/${name}`}
              className="field-tile flex min-h-14 items-center px-5 font-medium transition-transform duration-[120ms] ease-swoosh hover:translate-x-1"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
