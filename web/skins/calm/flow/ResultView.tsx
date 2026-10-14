"use client";

import { copy, fill } from "@/lib/copy";
import { changedCount, gaps } from "@/lib/resume";
import { changedWords, summaryOf } from "@/lib/result-text";
import type { Source } from "@/lib/run-machine";
import type { Result, Step } from "@/lib/types";
import { useKeptLines } from "@/components/flow/useKeptLines";
import { Mark } from "../primitives";
import { page, pageTop, textLink } from "../ui";
import { DownloadButton } from "./DownloadButton";
import { Gaps } from "./Gaps";
import { Paper } from "./Paper";
import { Questions } from "./Questions";
import { ReplayNote } from "./ReplayNote";
import { StepsToggle } from "./StepsToggle";

export type ResultViewProps = {
  result: Result;
  steps: Step[];
  source: Source;
  onAgain: () => void; // start over, or play the recording again
  againLabel: string;
  staticPdf?: string; // a ready-made PDF of the result (the recorded run has one)
};

/**
 * The result: a summary, the resume on a white sheet, and beside it (under it
 * on a phone) the jump list, the download, what was left out, any question.
 */
export function ResultView({ result, steps, source, onAgain, againLabel, staticPdf }: ResultViewProps) {
  const { kept, keep, openId, setOpenId, jumpTo } = useKeptLines();
  const changed = changedCount(result, kept);
  const jumps = changedWords(result).filter((jump) => !kept.has(jump.id));

  return (
    <div className={`${pageTop} pb-24`}>
      {source === "replay" && <ReplayNote />}
      <div className={`${page} grid gap-x-12 ${source === "replay" ? "pt-8" : ""} lg:grid-cols-12 lg:items-start`}>
        <h1 tabIndex={-1} data-focus className="t-title rise order-first max-w-[22ch] pb-8 outline-none lg:col-span-12 lg:pb-12">
          {summaryOf(result, changed)}
        </h1>
        {/* On a phone the aside's children join the single column (contents):
            summary, download, resume, the rest. From lg it is a sticky column. */}
        <aside className="contents lg:sticky lg:top-6 lg:order-2 lg:col-span-5 lg:-m-2 lg:block lg:max-h-[calc(100dvh-3rem)] lg:space-y-8 lg:overflow-y-auto lg:p-2">
          <div className="order-1 pb-6 lg:pb-0">
            <DownloadButton result={result} kept={kept} staticPdf={staticPdf} />
          </div>
          <div className="order-3 space-y-8 pt-10 lg:pt-0">
            {jumps.length > 0 && (
              <section>
                <p className="t-small text-ink-soft">{copy.result_hint}</p>
                <ul className="mt-3 flex flex-col items-start gap-1">
                  {jumps.map((jump) => (
                    <li key={jump.id} className="max-w-full">
                      <button
                        type="button"
                        onClick={() => jumpTo(jump.id)}
                        className="min-h-11 max-w-full rounded-field px-1 text-left leading-snug transition-transform duration-[160ms] ease-calm hover:translate-x-0.5"
                      >
                        <Mark className="t-small font-medium">{jump.words}</Mark>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <Gaps missing={gaps(result)} />
            <Questions questions={result.questions} />
            <div>
              <p className="t-small text-ink-soft">{fill(copy.result_time, { seconds: Math.round(result.stats.seconds) })}</p>
              <div className="flex flex-wrap items-center gap-x-6">
                <button type="button" onClick={onAgain} className={`${textLink} t-small`}>
                  {againLabel}
                </button>
                <StepsToggle steps={steps} />
              </div>
            </div>
          </div>
        </aside>
        <div className="order-2 lg:order-1 lg:col-span-7">
          <Paper result={result} label={copy.result_resume_label} kept={kept} openId={openId} onOpen={setOpenId} onKeep={keep} />
        </div>
      </div>
    </div>
  );
}
