"use client";

import Link from "next/link";
import { useId, type Dispatch, type FormEvent, type ReactNode } from "react";
import { REPLAY_ONLY } from "@/lib/config";
import { copy } from "@/lib/copy";
import { jobProblem, resumeProblem, type RunEvent, type RunState } from "@/lib/run-machine";
import { problemSentence } from "@/lib/steps";
import { Turnstile } from "../Turnstile";
import { page, primaryButton, quietLink } from "../ui";
import { ResumeField } from "./ResumeField";

type Props = {
  state: Extract<RunState, { status: "idle" | "ready" }>;
  dispatch: Dispatch<RunEvent>;
  onSubmit: () => void;
  onToken: (token: string) => void;
  waiting: boolean; // the button was pressed before the bot check finished
};

/**
 * One step of the form: its label, then the field. The order is shown by
 * position alone (and by the list the steps sit in, for screen readers).
 * The last step has no label: the button says what it does.
 */
function Step({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <li>
      {label && <div className="lead mb-3 font-bold">{label}</div>}
      {children}
    </li>
  );
}

/**
 * The whole input on one screen: your resume, the job post, the button.
 * The resume box is white, because white is the resume everywhere on the
 * site. The job post box is a dark tile. The button is cyan.
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
    <form
      onSubmit={submit}
      noValidate
      className={`${page} grid gap-x-10 gap-y-8 pb-[var(--chapter)] pt-6 lg:grid-cols-12 lg:pt-14`}
    >
      {/* The title runs the full width, as large as it can be on one line. */}
      <h1 className="head poster enter lg:col-span-12">{copy.flow_title}</h1>
      <div className="enter min-w-0 lg:col-span-5">
        {REPLAY_ONLY && <p className="field-recorded max-w-md px-4 py-3">{copy.flow_preview_note}</p>}
      </div>

      {/* min-w-0 lets the column shrink below its longest unbreakable word (a
          long file name), so nothing pushes the page wider than the screen. */}
      <ol className="stagger min-w-0 space-y-9 lg:col-span-7">
        <Step label={copy.flow_step_resume}>
          <ResumeField input={input} problem={resumeCode && problemSentence(resumeCode)} dispatch={dispatch} />
        </Step>

        <Step label={<label htmlFor={job}>{copy.flow_step_job}</label>}>
          <textarea
            id={job}
            aria-describedby={jobCode ? jobHint : undefined}
            aria-invalid={Boolean(jobCode)}
            value={input.jobText}
            onChange={(event) => dispatch({ type: "job_typed", text: event.target.value })}
            rows={5}
            placeholder={copy.flow_job_placeholder}
            // A problem puts an orange bar on the box's left edge.
            className="field-tile block min-h-40 w-full border-l-8 border-tile p-4 placeholder:text-muted aria-invalid:border-left-out"
          />
          {jobCode && (
            <p id={jobHint} role="alert" className="enter mt-2 font-medium text-left-out">
              {problemSentence(jobCode)}
            </p>
          )}
        </Step>

        <Step>
          {!REPLAY_ONLY && <Turnstile onToken={onToken} />}
          <button type="submit" disabled={waiting} className={`${primaryButton} w-full`}>
            {waiting && <span aria-hidden className="breathe h-2.5 w-2.5 bg-black" />}
            {REPLAY_ONLY ? copy.flow_submit_replay : copy.flow_submit}
          </button>
          {/* role="status": read out when it appears, without stealing focus. */}
          <p role="status" className="small mt-3 text-muted">
            {waiting ? (
              copy.flow_bot_wait
            ) : (
              <>
                {copy.flow_facts}{" "}
                <Link href="/privacy" className={`${quietLink} min-h-0 text-ink`}>
                  {copy.flow_facts_link}
                </Link>
              </>
            )}
          </p>
        </Step>
      </ol>
    </form>
  );
}
