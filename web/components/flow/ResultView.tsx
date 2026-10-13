"use client";

import { useState } from "react";
import { copy, fill } from "@/lib/copy";
import { diffWords } from "@/lib/diff";
import { changedCount, gaps } from "@/lib/resume";
import type { Source } from "@/lib/run-machine";
import type { Result, Step } from "@/lib/types";
import { page, quietLink } from "../ui";
import { DownloadButton } from "./DownloadButton";
import { Gaps } from "./Gaps";
import { Paper } from "./Paper";
import { Questions } from "./Questions";
import { ReplayNote } from "./ReplayNote";
import { StepsToggle } from "./StepsToggle";
import { lineAnchor } from "./TraceLine";

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

/** For each rewritten line: its ID and the first run of words that changed. */
function changedWords(result: Result): { id: string; words: string }[] {
  return result.bullets.map((bullet) => {
    const original = bullet.replaces ? (result.evidence[bullet.replaces] ?? "") : "";
    const first = diffWords(original, bullet.text).find((piece) => piece.changed);
    return { id: bullet.id, words: first?.text ?? bullet.text };
  });
}

/**
 * The result. Black around, and the resume on white in the middle of it, with
 * the changed words in lemon. Beside it (above and under it on a phone): one
 * summary line, a lemon block per changed line that jumps to it, the download
 * button, what the job asks for that the resume lacks, and any question the
 * run had.
 */
export function ResultView({ result, steps, source, onAgain, againLabel, staticPdf }: Props) {
  // Lines where the visitor chose their original. Every rewrite starts out in.
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const changed = changedCount(result, kept);
  const jumps = changedWords(result).filter((jump) => !kept.has(jump.id));

  function keep(bulletId: string, keepOriginal: boolean) {
    // Copy the set: React only re-draws when it is handed a new object.
    const next = new Set(kept);
    if (keepOriginal) next.add(bulletId);
    else next.delete(bulletId);
    setKept(next);
  }

  /** Open one changed line and bring it to the middle of the screen. */
  function jumpTo(bulletId: string) {
    setOpenId(bulletId);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(lineAnchor(bulletId))?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
  }

  return (
    <>
      {source === "replay" && <ReplayNote />}
      {/* One column on a phone: summary, resume, button, the rest. On a wide
          screen the resume is the left column and everything else sits to its
          right. "lg:contents" on the aside is what lets one set of elements do
          both: on a phone its children take part in the single column. */}
      <div className={`${page} grid gap-x-10 pt-8 lg:grid-cols-12 lg:items-start lg:pt-12`}>
        <aside className="contents lg:sticky lg:top-6 lg:order-2 lg:col-span-5 lg:-m-2 lg:block lg:max-h-[calc(100dvh-3rem)] lg:space-y-10 lg:overflow-y-auto lg:p-2">
          <header className="order-1 pb-6 lg:pb-0">
            <h1 tabIndex={-1} data-focus className="lead font-bold outline-none">
              {summaryOf(result, changed)}
            </h1>
            {result.bullets.length > 0 && <p className="small mt-2 font-normal">{copy.result_hint}</p>}
            {/* One lemon block per changed line, showing the words that changed.
                On a phone the changed lines are below the first screen: a tap
                here opens the line and scrolls to it. */}
            {jumps.length > 0 && (
              <ul className="mt-4 flex flex-col items-start gap-1">
                {jumps.map((jump) => (
                  <li key={jump.id}>
                    <button
                      type="button"
                      onClick={() => jumpTo(jump.id)}
                      className="field-changed min-h-11 px-3 py-2 text-left font-medium leading-snug transition-transform duration-[120ms] ease-swoosh hover:translate-x-1 active:translate-y-0.5 [--ring:#ffffff]"
                    >
                      {jump.words}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </header>
          {/* On a phone the button stays at the bottom of the screen while the
              resume scrolls, so it is always one tap away. */}
          <div className="sticky bottom-0 z-10 order-3 -mx-4 bg-ground px-4 py-3 sm:-mx-10 sm:px-10 lg:static lg:mx-0 lg:p-0">
            <DownloadButton result={result} kept={kept} staticPdf={staticPdf} />
          </div>
          <div className="order-4 space-y-10 pt-6 lg:pt-0">
            <Gaps missing={gaps(result)} />
            <Questions questions={result.questions} />
            <div>
              <p className="small text-muted">{fill(copy.result_time, { seconds: Math.round(result.stats.seconds) })}</p>
              <div className="flex flex-wrap items-start gap-x-6">
                <button type="button" onClick={onAgain} className={`${quietLink} small`}>
                  {againLabel}
                </button>
                <StepsToggle steps={steps} />
              </div>
            </div>
          </div>
        </aside>
        {/* On a phone the sheet runs from edge to edge of the screen. */}
        <div className="order-2 max-lg:-mx-4 sm:max-lg:-mx-10 lg:order-1 lg:col-span-7">
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
    </>
  );
}
