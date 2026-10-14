"use client";

import { useId, useRef, type FormEvent } from "react";
import { Turnstile } from "@/components/Turnstile";
import { useFileDrop } from "@/components/flow/useFileDrop";
import { REPLAY_ONLY } from "@/lib/config";
import { copy } from "@/lib/copy";
import { jobProblem, resumeProblem } from "@/lib/run-machine";
import type { ErrorCode } from "@/lib/types";
import type { HeroFormProps } from "../flow/contracts";
import { IDS } from "../flow/contracts";
import { FileIcon } from "../parts";

/** The sentence for a problem code, or null for a code the form never shows. */
function problemSentence(code: ErrorCode | "resume_missing" | "job_missing"): string | null {
  switch (code) {
    case "resume_missing":
      return copy.calm_err_resume_missing;
    case "file_not_pdf":
      return copy.calm_err_file_type;
    case "file_too_big":
      return copy.calm_err_file_big;
    case "file_no_text":
      return copy.calm_err_file_no_text;
    case "file_unreadable":
      return copy.calm_err_file_unreadable;
    case "resume_too_short":
      return copy.calm_err_resume_short;
    case "resume_too_long":
      return copy.calm_err_resume_long;
    case "job_missing":
      return copy.calm_err_job_missing;
    case "job_too_short":
      return copy.calm_err_job_short;
    case "job_too_long":
      return copy.calm_err_job_long;
    default:
      return null;
  }
}

const LABEL = "pl-1 text-[13px] font-semibold text-ink-700";
const PROBLEM = "px-1 text-[14px] leading-snug text-ink-900";
const TEXT_LINK = "inline-flex min-h-11 items-center self-start px-1 text-[14px] font-semibold text-ink-700 underline underline-offset-2 hover:text-ink-900";
const TEXTAREA = "field block w-full resize-none p-3 font-sans text-[16px] text-ink-900 wide:p-3.5";

/**
 * The hero form: the resume, the job post, the bot check, the button. A field
 * only complains after the button was pressed, or when a file was refused.
 */
export function HeroForm({ state, dispatch, onSubmit, onToken, waiting }: HeroFormProps) {
  const dragging = useFileDrop(dispatch);
  const picker = useRef<HTMLInputElement>(null);
  const resumeHint = useId();
  const jobHint = useId();
  const resumeBox = useId();
  const { input } = state;
  const touched = state.status === "idle" && state.touched;
  const server = state.status === "idle" ? state.serverProblem : null;

  // A refused file speaks at once; the rest waits for the button. A problem
  // the server found wins, as it knows more.
  const resumeCode = server?.startsWith("resume_") ? server : input.fileProblem || touched ? resumeProblem(input) : null;
  const jobCode = server?.startsWith("job_") ? server : touched ? jobProblem(input) : null;
  const resumeText = resumeCode ? problemSentence(resumeCode) : null;
  const jobText = jobCode ? problemSentence(jobCode) : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  const openPicker = () => picker.current?.click();
  const file = input.file;
  const dropBox =
    "field field-drop flex w-full items-center gap-3 p-3.5 text-left text-ink-900 wide:gap-3.5 wide:px-[18px] wide:py-4 " +
    (dragging ? "border-solid !border-ink-900 !bg-white/70" : "");

  let resume;
  if (input.mode === "text") {
    resume = (
      <>
        <label htmlFor={resumeBox} className={LABEL}>
          {copy.calm_form_resume_label}
        </label>
        <textarea
          id={resumeBox}
          value={input.resumeText}
          onChange={(event) => dispatch({ type: "resume_typed", text: event.target.value })}
          placeholder={copy.calm_form_resume_placeholder}
          aria-invalid={Boolean(resumeText)}
          aria-describedby={resumeText ? resumeHint : undefined}
          className={`${TEXTAREA} h-[132px]`}
        />
      </>
    );
  } else if (dragging) {
    resume = (
      <div className={dropBox}>
        <FileIcon />
        <span className="text-[15px] font-semibold wide:text-[16px]">{copy.calm_form_drop_now}</span>
      </div>
    );
  } else if (file) {
    // A file is chosen: its name, and a small button to pick another.
    resume = (
      <div className={`${dropBox} justify-between`}>
        <span className="flex min-w-0 items-center gap-3">
          <FileIcon />
          <span className="truncate text-[15px] font-semibold wide:text-[16px]">{file.name}</span>
        </span>
        <button
          type="button"
          id={IDS.drop}
          onClick={openPicker}
          aria-describedby={resumeText ? resumeHint : undefined}
          data-invalid={Boolean(resumeText)}
          className="inline-flex min-h-11 shrink-0 items-center px-1 text-[14px] font-semibold text-ink-700 underline underline-offset-2 hover:text-ink-900"
        >
          {copy.calm_form_change}
        </button>
      </div>
    );
  } else {
    resume = (
      <button
        type="button"
        id={IDS.drop}
        onClick={openPicker}
        aria-describedby={resumeText ? resumeHint : undefined}
        data-invalid={Boolean(resumeText)}
        className={dropBox}
      >
        <FileIcon />
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold wide:hidden">{copy.calm_form_drop_phone}</span>
          <span className="hidden text-[16px] font-semibold wide:inline">{copy.calm_form_drop}</span>
          <span className="text-[12px] text-ink-500 wide:hidden">{copy.calm_form_drop_hint_phone}</span>
          <span className="hidden text-[13px] text-ink-500 wide:inline">{copy.calm_form_drop_hint}</span>
        </span>
      </button>
    );
  }

  return (
    // noValidate: the browser's own pop-ups are off, ours are used.
    <form
      onSubmit={submit}
      noValidate
      className="glass flex flex-col gap-2.5 rounded-[24px] p-3 wide:gap-3 wide:rounded-[26px] wide:p-4"
    >
      <input
        ref={picker}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) dispatch({ type: "file_added", file: picked });
          event.target.value = ""; // picking the same file again still fires
        }}
      />
      {resume}
      {resumeText && (
        <p id={resumeHint} role="alert" className={PROBLEM}>
          {resumeText}
        </p>
      )}
      <button
        type="button"
        onClick={() => dispatch({ type: "mode_set", mode: input.mode === "text" ? "file" : "text" })}
        className={`${TEXT_LINK} -my-1.5`}
      >
        {input.mode === "text" ? copy.calm_form_upload : copy.calm_form_paste}
      </button>
      <label htmlFor={IDS.job} className={LABEL}>
        {copy.calm_form_job_label}
      </label>
      <textarea
        id={IDS.job}
        value={input.jobText}
        onChange={(event) => dispatch({ type: "job_typed", text: event.target.value })}
        placeholder={copy.calm_form_job_placeholder}
        aria-invalid={Boolean(jobText)}
        aria-describedby={jobText ? jobHint : undefined}
        className={`${TEXTAREA} h-[72px] wide:h-[84px] wide:text-[15px]`}
      />
      {jobText && (
        <p id={jobHint} role="alert" className={PROBLEM}>
          {jobText}
        </p>
      )}
      {!REPLAY_ONLY && <Turnstile onToken={onToken} />}
      <button
        type="submit"
        disabled={waiting}
        className="ink h-[52px] w-full rounded-2xl font-sans text-[16px] font-semibold wide:h-[54px]"
      >
        {REPLAY_ONLY ? copy.calm_form_submit_replay : copy.calm_form_submit}
      </button>
      {/* role="status": read out when it appears, without stealing focus. */}
      {waiting && (
        <p role="status" className="px-1 text-center text-[14px] text-ink-900">
          {copy.calm_form_bot_wait}
        </p>
      )}
    </form>
  );
}
