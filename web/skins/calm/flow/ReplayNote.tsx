"use client";

import { useId, useState } from "react";
import { copy } from "@/lib/copy";
import { EXAMPLE_RUN } from "@/lib/example";
import { page, textLink } from "../ui";

/**
 * The label on a recorded run: a quiet sky-wash bar under the header. Whenever
 * the screen shows the recording and not the visitor's own resume, this says
 * so, plainly. It also offers the job post the recording was tailored to, and
 * (while it is still playing) a way to skip to the end.
 */
export function ReplayNote({ onSkip }: { onSkip?: () => void }) {
  const [showJob, setShowJob] = useState(false);
  const job = useId(); // ties the toggle to the text it opens, for screen readers
  return (
    <div className={page}>
      <div className="rounded-field bg-sky-wash px-4 py-3 sm:px-5">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-semibold">{copy.replay_label}</span>
          <span className="max-w-[60ch] text-ink-soft">{copy.replay_note}</span>
        </p>
        <div className="t-small flex flex-wrap gap-x-6">
          <button
            type="button"
            aria-expanded={showJob}
            aria-controls={showJob ? job : undefined}
            onClick={() => setShowJob(!showJob)}
            className={textLink}
          >
            {copy.replay_job_toggle}
          </button>
          {onSkip && (
            <button type="button" onClick={onSkip} className={`${textLink} font-medium`}>
              {copy.replay_skip}
            </button>
          )}
        </div>
        {showJob && (
          // whitespace-pre-line keeps the job post's own line breaks.
          <p
            id={job}
            // tabIndex: a box that scrolls must be reachable by keyboard.
            tabIndex={0}
            className="rise mb-1 mt-1 max-h-64 overflow-y-auto whitespace-pre-line rounded-field bg-paper p-4 ring-1 ring-line"
          >
            {EXAMPLE_RUN.jd_text}
          </p>
        )}
      </div>
    </div>
  );
}
