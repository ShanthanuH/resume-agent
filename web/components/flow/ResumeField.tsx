"use client";

import { useEffect, useId, useState, type Dispatch } from "react";
import { copy } from "@/lib/copy";
import { fileSize } from "@/lib/format";
import type { Input, RunEvent } from "@/lib/run-machine";
import { quietLink } from "../ui";

type Props = {
  input: Input;
  problem: string | null; // the sentence to show under the field, if any
  dispatch: Dispatch<RunEvent>;
};

// Every look of the box has this height, so nothing below it moves when a
// file is added or removed. The outline shows when the hidden file input
// inside it has keyboard focus. The box is white: it is where the resume goes,
// and white is the resume everywhere on the site.
const BOX =
  "flex min-h-40 w-full flex-col justify-center px-5 py-4 " +
  "has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-[3px] has-[input:focus-visible]:outline-white";

/**
 * True while a file is being dragged over the page. A file dropped anywhere on
 * the page is taken, not only one dropped on the box: aiming is hard, and a
 * near miss would otherwise make the browser leave the page to open the PDF.
 */
function useFileDrop(dispatch: Dispatch<RunEvent>): boolean {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    // Dragging text or a link also fires these events. Only files matter here.
    const carriesFile = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    const over = (event: DragEvent) => {
      if (!carriesFile(event)) return;
      event.preventDefault(); // without this the browser refuses the drop
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      // relatedTarget is null only when the drag leaves the window itself.
      if (event.relatedTarget === null) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!carriesFile(event)) return;
      event.preventDefault(); // stop the browser from opening the file itself
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file) dispatch({ type: "file_added", file });
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [dispatch]);
  return dragging;
}

/**
 * Step 1: the resume. Drop a PDF or tap to pick one; "paste text instead" is
 * the small option underneath. The box has four looks: empty, a file being
 * dragged in, a file added, and a file that cannot be used.
 */
export function ResumeField({ input, problem, dispatch }: Props) {
  const dragging = useFileDrop(dispatch);
  const picker = useId(); // connects the visible labels to the hidden file input
  const hint = useId(); // connects the problem sentence to the field
  const { file, fileProblem, mode } = input;

  // The real file input. It is invisible but still in the page, so a keyboard
  // or a screen reader can reach it. The visible box is its label.
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
        event.target.value = ""; // so picking the same file again still fires onChange
      }}
    />
  );

  let box: React.ReactNode;
  if (dragging) {
    // A file is in the air: say so, whatever was in the box before.
    box = (
      <div className={`${BOX} field-action items-center text-center`}>
        <span className="lead font-bold">{copy.flow_drop_now}</span>
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
        rows={5}
        placeholder={copy.flow_resume_placeholder}
        className="field-sheet block min-h-40 w-full border-l-8 border-sheet p-4 placeholder:text-neutral-600 aria-invalid:border-left-out"
      />
    );
  } else if (file) {
    // A file is in. A file that cannot be used gets an orange bar on the left.
    box = (
      <div className={`${BOX} field-sheet border-l-8 ${fileProblem ? "border-left-out" : "border-sheet"}`}>
        {fileInput}
        <div className="flex items-center gap-3">
          <span className="small bg-black px-1.5 py-0.5 font-bold text-white">PDF</span>
          <p className="lead min-w-0 flex-1 truncate font-bold">{file.name}</p>
          <p className="small tabular shrink-0">{fileSize(file.size)}</p>
        </div>
        <div className="small mt-1 flex gap-6">
          <label htmlFor={picker} className={`${quietLink} cursor-pointer`}>
            {copy.flow_file_change}
          </label>
          <button type="button" onClick={() => dispatch({ type: "file_removed" })} className={quietLink}>
            {copy.flow_file_remove}
          </button>
        </div>
      </div>
    );
  } else {
    // Empty. The whole box is the label of the file input, so a tap or a
    // click anywhere on it opens the file picker.
    box = (
      <label
        htmlFor={picker}
        className={`${BOX} field-sheet cursor-pointer items-center text-center transition-transform duration-[120ms] ease-swoosh hover:-translate-y-0.5`}
      >
        {fileInput}
        <span className="lead font-bold">{copy.flow_drop}</span>
        <span className="small mt-1">{copy.flow_drop_hint}</span>
      </label>
    );
  }

  return (
    <div>
      {box}
      {/* The problem sits in the same place for every kind of input. */}
      {problem && (
        <p id={hint} role="alert" className="enter mt-2 font-medium text-left-out">
          {problem}
        </p>
      )}
      <button
        type="button"
        onClick={() => dispatch({ type: "mode_set", mode: mode === "text" ? "file" : "text" })}
        className={`${quietLink} small`}
      >
        {mode === "text" ? copy.flow_upload_instead : copy.flow_paste_instead}
      </button>
    </div>
  );
}
