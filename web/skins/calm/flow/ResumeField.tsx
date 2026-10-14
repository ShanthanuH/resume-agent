"use client";

import { useId, type Dispatch, type ReactNode } from "react";
import { useFileDrop } from "@/components/flow/useFileDrop";
import { copy } from "@/lib/copy";
import { fileSize } from "@/lib/format";
import type { Input, RunEvent } from "@/lib/run-machine";
import { field, textLink } from "../ui";

type Props = {
  input: Input;
  problem: string | null; // the sentence to show under the field, if any
  dispatch: Dispatch<RunEvent>;
};

// Every look has this height, so nothing below moves when a file comes or goes.
const BOX =
  "flex h-40 w-full flex-col items-center justify-center rounded-field px-5 text-center " +
  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-sky-ink";

function UploadIcon() {
  return (
    <svg aria-hidden width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 20V6M8.5 11.5 14 6l5.5 5.5M5 21v1.5A1.5 1.5 0 0 0 6.5 24h15a1.5 1.5 0 0 0 1.5-1.5V21" />
    </svg>
  );
}

/**
 * Step 1: the resume. Drop a PDF or tap to pick one; "paste text instead" is
 * the small option underneath. The box has four looks: empty, a file being
 * dragged in, a file added, and a file that cannot be used.
 */
export function ResumeField({ input, problem, dispatch }: Props) {
  const dragging = useFileDrop(dispatch);
  const picker = useId();
  const hint = useId();
  const { file, fileProblem, mode } = input;

  // The real file input: invisible but reachable by keyboard and screen reader.
  const fileInput = (
    <input
      id={picker}
      type="file"
      accept="application/pdf,.pdf"
      className="sr-only"
      aria-describedby={problem ? hint : undefined}
      aria-invalid={Boolean(problem)}
      onChange={(event) => {
        const picked = event.target.files?.[0];
        if (picked) dispatch({ type: "file_added", file: picked });
        event.target.value = ""; // picking the same file again still fires
      }}
    />
  );

  let box: ReactNode;
  if (dragging) {
    box = (
      <div className={`${BOX} bg-sky-wash text-sky-ink ring-2 ring-sky-ink/60`}>
        <UploadIcon />
        <span className="t-body mt-2 font-medium">{copy.flow_drop_now}</span>
      </div>
    );
  } else if (mode === "text") {
    box = (
      <textarea
        aria-label={copy.flow_resume_text_label}
        aria-describedby={problem ? hint : undefined}
        aria-invalid={Boolean(problem)}
        value={input.resumeText}
        onChange={(event) => dispatch({ type: "resume_typed", text: event.target.value })}
        placeholder={copy.flow_resume_placeholder}
        className={`${field} h-40 resize-none`}
      />
    );
  } else if (file) {
    box = (
      <div className={`${BOX} bg-mist ${fileProblem ? "ring-2 ring-problem" : "ring-1 ring-line"}`}>
        {fileInput}
        <p className="t-body max-w-full truncate font-medium">{file.name}</p>
        <p className="t-small tabular-nums text-ink-soft">{fileSize(file.size)}</p>
        <div className="mt-1 flex gap-6">
          <label htmlFor={picker} className={`${textLink} t-small`}>
            {copy.flow_file_change}
          </label>
          <button type="button" onClick={() => dispatch({ type: "file_removed" })} className={`${textLink} t-small`}>
            {copy.flow_file_remove}
          </button>
        </div>
      </div>
    );
  } else {
    // Empty: the whole box is the label of the file input.
    box = (
      <label
        htmlFor={picker}
        className={`${BOX} cursor-pointer bg-mist text-ink-soft ring-1 ring-line transition-colors duration-[160ms] ease-calm hover:bg-sky-wash hover:text-sky-ink`}
      >
        {fileInput}
        <UploadIcon />
        <span className="t-body mt-2 font-medium text-ink">{copy.flow_drop}</span>
        <span className="t-small mt-0.5">{copy.flow_drop_hint}</span>
      </label>
    );
  }

  return (
    <div>
      {box}
      {problem && (
        <p id={hint} role="alert" className="t-small mt-2 font-medium text-problem">
          {problem}
        </p>
      )}
      <button
        type="button"
        onClick={() => dispatch({ type: "mode_set", mode: mode === "text" ? "file" : "text" })}
        className={`${textLink} t-small mt-1`}
      >
        {mode === "text" ? copy.flow_upload_instead : copy.flow_paste_instead}
      </button>
    </div>
  );
}
