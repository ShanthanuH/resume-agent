import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/skins/calm/pages/PageFrame";
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
    <PageFrame>
      <h1 className="font-serif text-[38px] leading-[1.1] text-ink-900 wide:text-[46px]">{copy.states_title}</h1>
      <p className="mt-4 text-[17px] leading-[1.6] text-ink-700">{copy.states_lead}</p>
      <ul className="mt-8 space-y-3">
        {LABELS.map(([name, label]) => (
          <li key={name}>
            {/* "empty" is simply the flow page itself. */}
            <Link
              href={name === "empty" ? "/try" : `/states/${name}`}
              className="glass lift flex min-h-14 items-center justify-between gap-4 rounded-[18px] px-5 font-semibold text-ink-900"
            >
              {label}
              <span aria-hidden>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
