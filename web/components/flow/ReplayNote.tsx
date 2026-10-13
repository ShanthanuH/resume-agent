"use client";

import { useId, useState } from "react";
import { copy } from "@/lib/copy";
import { EXAMPLE_RUN } from "@/lib/example";
import { quietLink } from "../ui";

/**
 * The label on a recorded run. Whenever the screen shows the recording and not
 * the visitor's own resume, this says so, plainly and at the top. It also
 * offers the job post the recording was tailored to, and (while it is still
 * playing) a way to skip to the end.
 */
export function ReplayNote({ onSkip }: { onSkip?: () => void }) {
  const [showJob, setShowJob] = useState(false);
  const job = useId(); // ties the toggle to the text it opens, for screen readers
  return (
    <div className="mb-8 border-b border-rule pb-2 text-sm">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="label rounded-full border border-ink px-2.5 py-1 text-ink">{copy.replay_label}</span>
        <span className="text-soft">{copy.replay_note}</span>
      </p>
      <div className="mt-1 flex flex-wrap gap-x-6">
        <button
          type="button"
          aria-expanded={showJob}
          aria-controls={showJob ? job : undefined}
          onClick={() => setShowJob(!showJob)}
          className={`${quietLink} text-soft`}
        >
          {copy.replay_job_toggle}
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className={`${quietLink} font-medium`}>
            {copy.replay_skip}
          </button>
        )}
      </div>
      {showJob && (
        // whitespace-pre-line keeps the job post's own line breaks.
        <p
          id={job}
          className="enter mb-3 mt-1 max-h-64 overflow-y-auto whitespace-pre-line rounded-md border border-rule bg-sheet p-4 text-soft"
        >
          {EXAMPLE_RUN.jd_text}
        </p>
      )}
    </div>
  );
}
