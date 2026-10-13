"use client";

import { useState } from "react";
import { copy, fill } from "@/lib/copy";
import { changedCount, gaps } from "@/lib/resume";
import type { Source } from "@/lib/run-machine";
import type { Result, Step } from "@/lib/types";
import { quietLink } from "../ui";
import { DownloadButton } from "./DownloadButton";
import { Gaps } from "./Gaps";
import { Paper } from "./Paper";
import { Questions } from "./Questions";
import { ReplayNote } from "./ReplayNote";
import { StepsToggle } from "./StepsToggle";

type Props = {
  result: Result;
  steps: Step[];
  source: Source;
  onAgain: () => void; // start over, or play the recording again
  againLabel: string;
  staticPdf?: string; // see DownloadButton
};

/** The one summary line: how many lines changed, in words that stay true. */
function summaryOf(result: Result, changed: number): string {
  if (result.bullets.length === 0) return copy.result_summary_none;
  if (changed === 0) return copy.result_summary_all_kept; // the visitor kept every original
  return changed === 1 ? copy.result_summary_one : fill(copy.result_summary_many, { count: changed });
}

/**
 * The result. The tailored resume comes first and large, with the changed
 * words highlighted. Beside it (under it on a phone): one summary line, the
 * download button, what the job asks for that the resume lacks, and any
 * question the run had.
 */
export function ResultView({ result, steps, source, onAgain, againLabel, staticPdf }: Props) {
  // Lines where the visitor chose their original. Every rewrite starts out in.
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const changed = changedCount(result, kept);

  function keep(bulletId: string, keepOriginal: boolean) {
    // Copy the set: React only re-draws when it is handed a new object.
    const next = new Set(kept);
    if (keepOriginal) next.add(bulletId);
    else next.delete(bulletId);
    setKept(next);
  }

  return (
    <div>
      {source === "replay" && <ReplayNote />}
      {/* One column on a phone: summary, resume, button, the rest. On a wide
          screen the resume is the left column and everything else sits to its
          right. "lg:contents" on the aside is what lets one set of elements do
          both: on a phone its children take part in the single column. */}
      <div className="grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <aside className="contents lg:sticky lg:top-6 lg:order-2 lg:block lg:max-h-[calc(100dvh-3rem)] lg:space-y-8 lg:overflow-y-auto">
          <header className="order-1">
            <h1 tabIndex={-1} data-focus className="display text-[1.75rem] outline-none sm:text-[2rem]">
              {summaryOf(result, changed)}
            </h1>
            {result.bullets.length > 0 && <p className="mt-2 text-sm text-soft">{copy.result_hint}</p>}
          </header>
          {/* On a phone the button stays at the bottom of the screen while the
              resume scrolls, so it is always one tap away. */}
          <div className="sticky bottom-0 z-10 order-3 -mx-5 border-t border-rule bg-paper px-5 py-3 sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-0 lg:p-0">
            <DownloadButton result={result} kept={kept} staticPdf={staticPdf} />
          </div>
          <div className="order-4 space-y-8">
            <Gaps missing={gaps(result)} />
            <Questions questions={result.questions} />
            <div className="border-t border-rule pt-4">
              <p className="text-sm text-muted">
                {fill(copy.result_time, { seconds: Math.round(result.stats.seconds) })}
              </p>
              <div className="flex flex-wrap items-start gap-x-6">
                <button type="button" onClick={onAgain} className={`${quietLink} text-sm text-soft`}>
                  {againLabel}
                </button>
                <StepsToggle steps={steps} />
              </div>
            </div>
          </div>
        </aside>
        <div className="order-2 lg:order-1">
          <Paper
            result={result}
            label={copy.result_resume_label}
            kept={kept}
            openId={openId}
            onOpen={setOpenId}
            onKeep={keep}
          />
        </div>
      </div>
    </div>
  );
}
