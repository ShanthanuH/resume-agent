"use client";

import { useState } from "react";
import { useDownload } from "@/components/flow/useDownload";
import { useKeptLines } from "@/components/flow/useKeptLines";
import { copy } from "@/lib/copy";
import { changedCount } from "@/lib/resume";
import type { ResultViewProps } from "../flow/contracts";
import { Glass, Wordmark } from "../parts";
import { ChangeCards, DownloadBar, Missing, Questions, Summary } from "./Panel";
import { ResumePage } from "./ResumePage";

/** The result: the resume page and the panel. */
export function ResultView({ result, job, staticPdf, onTryAnother, note }: ResultViewProps) {
  const { kept, keep, openId, setOpenId, jumpTo } = useKeptLines();
  const { state, download } = useDownload(result, kept);
  const [showChanges, setShowChanges] = useState(true);

  // The ready-made PDF has every rewrite in, so it only fits while none is kept.
  const pdf = kept.size === 0 ? staticPdf : undefined;

  return (
    <main className="relative min-h-svh bg-[#DCE9F6] desk:h-svh desk:min-h-[700px] desk:overflow-hidden">
      {/* One blurred photo, a light wash over it, and the content on top. */}
      <div aria-hidden className="res-sky fixed inset-[-60px] scale-105 opacity-85 blur-[28px]" />
      <div
        aria-hidden
        className="fixed inset-0 bg-[linear-gradient(180deg,rgba(234,241,248,.35)_0%,rgba(234,241,248,.75)_100%)]"
      />
      <div className="relative z-10 flex min-h-svh flex-col gap-3 px-4 pt-3 pb-3 desk:h-full desk:min-h-0 desk:gap-6 desk:px-8 desk:pt-5 desk:pb-8">
        <Glass
          tone="photo"
          className="order-0 flex h-16 shrink-0 items-center justify-between rounded-[22px] px-[22px]"
        >
          <Wordmark className="text-[26px]" />
          <button
            type="button"
            onClick={onTryAnother}
            className="glass glass-photo lift min-h-11 rounded-full px-[18px] py-2.5 text-[14px] font-semibold text-ink-900"
          >
            {copy.calm_result_try_another}
          </button>
        </Glass>
        {note && <div className="order-0">{note}</div>}
        <div className="res-grid">
          <div className="res-paper relative order-2 overflow-hidden rounded-[22px] bg-white shadow-[0_20px_50px_rgba(16,44,80,.16)] desk:min-h-0">
            <ResumePage
              result={result}
              kept={kept}
              showChanges={showChanges}
              openId={openId}
              onToggle={(id) => setOpenId(openId === id ? null : id)}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[90px] bg-[linear-gradient(180deg,rgba(255,255,255,0),#fff)] desk:block"
            />
          </div>
          <div className="res-aside">
            <Summary
              result={result}
              title={job?.title ?? copy.calm_result_job_fallback}
              company={job?.company ?? null}
              changed={changedCount(result, kept)}
              showChanges={showChanges}
              onShowChanges={setShowChanges}
            />
            <ChangeCards bullets={result.bullets} kept={kept} onJump={jumpTo} onKeep={keep} />
            <Missing result={result} />
            <Questions questions={result.questions} />
            <DownloadBar state={state} staticPdf={pdf} onDownload={download} />
          </div>
        </div>
      </div>
    </main>
  );
}
