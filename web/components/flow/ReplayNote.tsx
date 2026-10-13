"use client";

import { useId, useState } from "react";
import { copy } from "@/lib/copy";
import { EXAMPLE_RUN } from "@/lib/example";
import { page, quietLink } from "../ui";

/**
 * The label on a recorded run: a band of cornflower across the top, the
 * site's colour for "this is not your data". Whenever the screen shows the
 * recording and not the visitor's own resume, this says so, plainly. It also
 * offers the job post the recording was tailored to, and (while it is still
 * playing) a way to skip to the end.
 */
export function ReplayNote({ onSkip }: { onSkip?: () => void }) {
  const [showJob, setShowJob] = useState(false);
  const job = useId(); // ties the toggle to the text it opens, for screen readers
  return (
    <div className="field-recorded">
      <div className={`${page} py-3`}>
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-bold">{copy.replay_label}</span>
          <span className="small font-normal">{copy.replay_note}</span>
        </p>
        <div className="small flex flex-wrap gap-x-6">
          <button
            type="button"
            aria-expanded={showJob}
            aria-controls={showJob ? job : undefined}
            onClick={() => setShowJob(!showJob)}
            className={quietLink}
          >
            {copy.replay_job_toggle}
          </button>
          {onSkip && (
            <button type="button" onClick={onSkip} className={`${quietLink} font-bold`}>
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
            className="field-tile enter mb-3 mt-1 max-h-64 overflow-y-auto whitespace-pre-line p-4"
          >
            {EXAMPLE_RUN.jd_text}
          </p>
        )}
      </div>
    </div>
  );
}
