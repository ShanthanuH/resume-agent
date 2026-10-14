"use client";

import Link from "next/link";
import { useId, type Dispatch, type FormEvent } from "react";
import { REPLAY_ONLY } from "@/lib/config";
import { copy } from "@/lib/copy";
import { jobProblem, resumeProblem, type RunEvent, type RunState } from "@/lib/run-machine";
import { problemSentence } from "@/lib/steps";
import { Turnstile } from "@/components/Turnstile";
import { ArrowDot, Card } from "../primitives";
import { field, inlineLink, page, pageTop, primaryButton, primaryButtonPlain, problemText } from "../ui";
import { ResumeField } from "./ResumeField";

// The contract with Flow. Do not change these props.
export type InputFormProps = {
  state: Extract<RunState, { status: "idle" | "ready" }>;
  dispatch: Dispatch<RunEvent>;
  onSubmit: () => void;
  onToken: (token: string) => void;
  waiting: boolean; // the button was pressed before the bot check finished
};

/**
 * The whole input on one card: your resume, the job post, the button. A field
 * only complains after the button was pressed, or when a file was refused.
 */
export function InputForm({ state, dispatch, onSubmit, onToken, waiting }: InputFormProps) {
  const job = useId();
  const jobHint = useId();
  const { input } = state;
  const touched = state.status === "idle" && state.touched;
  const server = state.status === "idle" ? state.serverProblem : null;

  // A refused file speaks at once; the rest waits for the button. A problem
  // the server found wins, as it knows more.
  const resume = resumeProblem(input);
  const resumeCode = server?.startsWith("resume_") ? server : input.fileProblem || touched ? resume : null;
  const jobCode = server?.startsWith("job_") ? server : touched ? jobProblem(input) : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  const label = "t-heading mb-3 block";

  return (
    // noValidate: the browser's own pop-ups are off, ours are used.
    <form onSubmit={submit} noValidate className={`${page} ${pageTop} pb-20`}>
      <div className="mx-auto max-w-[40rem]">
        <h1 className="t-title rise mb-8 text-center sm:mb-10">{copy.flow_title}</h1>
        {REPLAY_ONLY && <p className="t-small mb-4 rounded-field bg-sky-wash px-4 py-3 text-sky-ink">{copy.flow_preview_note}</p>}
        <Card className="rise rise-2" coreClassName="p-5 sm:p-8">
          <div className="min-w-0 space-y-8">
            <div>
              <p className={label}>{copy.flow_step_resume}</p>
              <ResumeField input={input} problem={resumeCode && problemSentence(resumeCode)} dispatch={dispatch} />
            </div>
            <div>
              <label htmlFor={job} className={label}>
                {copy.flow_step_job}
              </label>
              <textarea
                id={job}
                aria-describedby={jobCode ? jobHint : undefined}
                aria-invalid={Boolean(jobCode)}
                value={input.jobText}
                onChange={(event) => dispatch({ type: "job_typed", text: event.target.value })}
                rows={5}
                placeholder={copy.flow_job_placeholder}
                className={`${field} min-h-40`}
              />
              {jobCode && (
                <p id={jobHint} role="alert" className={problemText}>
                  {problemSentence(jobCode)}
                </p>
              )}
            </div>
            <div>
              {!REPLAY_ONLY && <Turnstile onToken={onToken} />}
              <button
                type="submit"
                disabled={waiting}
                className={`${waiting ? primaryButtonPlain : `${primaryButton} justify-between`} w-full`}
              >
                {waiting && <span aria-hidden className="breathe h-2 w-2 rounded-full bg-white" />}
                {REPLAY_ONLY ? copy.flow_submit_replay : copy.flow_submit}
                {!waiting && <ArrowDot />}
              </button>
              {/* role="status": read out when it appears, without stealing focus. */}
              <p role="status" className="t-small mt-4 text-center text-ink-soft">
                {waiting ? (
                  copy.flow_bot_wait
                ) : (
                  <>
                    {copy.flow_facts}{" "}
                    <Link href="/privacy" className={inlineLink}>
                      {copy.flow_facts_link}
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </form>
  );
}
