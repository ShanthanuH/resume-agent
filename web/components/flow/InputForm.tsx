"use client";

import Link from "next/link";
import { useId, type Dispatch, type FormEvent, type ReactNode } from "react";
import { REPLAY_ONLY } from "@/lib/config";
import { copy } from "@/lib/copy";
import { jobProblem, resumeProblem, type RunEvent, type RunState } from "@/lib/run-machine";
import { problemSentence } from "@/lib/steps";
import { Turnstile } from "../Turnstile";
import { primaryButton, quietLink } from "../ui";
import { ResumeField } from "./ResumeField";

type Props = {
  state: Extract<RunState, { status: "idle" | "ready" }>;
  dispatch: Dispatch<RunEvent>;
  onSubmit: () => void;
  onToken: (token: string) => void;
  waiting: boolean; // the button was pressed before the bot check finished
};

/**
 * One numbered step: a big numeral in the margin, then the label and the field.
 * Step 3 has no label: the button under it says what it does.
 */
function Step({ number, label, children }: { number: number; label?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[2.75rem_minmax(0,1fr)]">
      <span aria-hidden className="display text-[1.75rem] leading-none text-muted sm:text-[2rem]">
        {number}
      </span>
      <div>
        {label && <div className="mb-2 font-medium">{label}</div>}
        {children}
      </div>
    </div>
  );
}

/**
 * The whole input on one screen: 1 your resume, 2 the job post, 3 the button.
 *
 * A field only complains after the button was pressed, or when a file was
 * refused. Nobody wants "too short" while they are still pasting.
 */
export function InputForm({ state, dispatch, onSubmit, onToken, waiting }: Props) {
  const job = useId(); // ties the job label to its text box
  const jobHint = useId();
  const { input } = state;
  const touched = state.status === "idle" && state.touched;
  const server = state.status === "idle" ? state.serverProblem : null;

  // What each field says. A refused file speaks at once; the rest waits for
  // the button. A problem the server found wins, as it knows more.
  const resume = resumeProblem(input);
  const resumeCode = server?.startsWith("resume_") ? server : input.fileProblem || touched ? resume : null;
  const jobCode = server?.startsWith("job_") ? server : touched ? jobProblem(input) : null;

  function submit(event: FormEvent) {
    event.preventDefault(); // stop the browser's own form post and page reload
    onSubmit();
  }

  return (
    // noValidate: the browser's own pop-up messages are off, ours are used.
    <form onSubmit={submit} noValidate className="mx-auto w-full max-w-xl">
      <h1 className="display text-[2rem] sm:text-[2.5rem]">{copy.flow_title}</h1>
      {REPLAY_ONLY && (
        <p className="mt-4 rounded-md border border-rule bg-sheet px-4 py-3 text-sm text-soft">
          {copy.flow_preview_note}
        </p>
      )}

      <div className="mt-8 space-y-8">
        <Step number={1} label={copy.flow_step_resume}>
          <ResumeField input={input} problem={resumeCode && problemSentence(resumeCode)} dispatch={dispatch} />
        </Step>

        <Step number={2} label={<label htmlFor={job}>{copy.flow_step_job}</label>}>
          <textarea
            id={job}
            aria-describedby={jobCode ? jobHint : undefined}
            aria-invalid={Boolean(jobCode)}
            value={input.jobText}
            onChange={(event) => dispatch({ type: "job_typed", text: event.target.value })}
            rows={5}
            placeholder={copy.flow_job_placeholder}
            className="block min-h-[7.5rem] w-full rounded-[10px] border border-rule bg-sheet p-4 text-base placeholder:text-muted focus:border-ink"
          />
          {jobCode && (
            <p id={jobHint} role="alert" className="enter mt-2 text-sm text-danger">
              {problemSentence(jobCode)}
            </p>
          )}
        </Step>

        <Step number={3}>
          {!REPLAY_ONLY && <Turnstile onToken={onToken} />}
          <button type="submit" disabled={waiting} className={`${primaryButton} w-full`}>
            {waiting && <span aria-hidden className="breathe h-2 w-2 rounded-full bg-paper" />}
            {REPLAY_ONLY ? copy.flow_submit_replay : copy.flow_submit}
          </button>
          {/* role="status": read out when it appears, without stealing focus. */}
          <p role="status" className="mt-3 text-sm text-muted">
            {waiting ? (
              copy.flow_bot_wait
            ) : (
              <>
                {copy.flow_facts}{" "}
                <Link href="/privacy" className={`${quietLink} min-h-0 text-soft`}>
                  {copy.flow_facts_link}
                </Link>
              </>
            )}
          </p>
        </Step>
      </div>
    </form>
  );
}
