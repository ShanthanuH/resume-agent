// Turns the facts of a run into the words shown for them. The words are in
// content/copy.yaml; this file only picks the right one and fills it in.

import { copy, fill } from "./copy";
import type { Phase } from "./run-machine";
import type { ErrorCode, Step, StepKind } from "./types";

/** The one sentence shown while a run is in each stage. */
export const PHASE_SENTENCE: Record<Phase, string> = {
  reading: copy.run_reading,
  matching: copy.run_matching,
  rewriting: copy.run_rewriting,
  checking: copy.run_checking,
  fixing: copy.run_fixing,
  building: copy.run_building,
};

// One sentence per kind of step. null means the step is not shown: a "plan" is
// the run deciding what to do next, which says nothing a visitor needs.
const STEP_SENTENCE: Record<StepKind, string | null> = {
  read_resume: copy.step_read_resume,
  read_job: copy.step_read_job,
  plan: null,
  match_found: copy.step_match_found,
  match_missing: copy.step_match_missing,
  rewrote: copy.step_rewrote,
  kept: copy.step_kept,
  rewrite_empty: copy.step_rewrite_empty,
  check_passed: copy.step_check_passed,
  check_failed: copy.step_check_failed,
  dropped: copy.step_dropped,
  asked: copy.step_asked,
  assembled: copy.step_assembled,
  assembled_fallback: copy.step_assembled_fallback,
  assemble_retry: copy.step_assemble_retry,
  refused: copy.step_refused,
  tool_error: copy.step_tool_error,
  other: null,
};

/** The sentence for one step, or null if it is not shown. */
export function stepSentence(step: Step): string | null {
  // A kind this version has never heard of is treated like "other".
  const template = STEP_SENTENCE[step.kind] ?? null;
  if (template === null) return null;
  return fill(template, {
    count: step.count ?? 0,
    requirement: step.requirement ?? "",
    before: step.before ?? "",
    after: step.after ?? "",
  });
}

/** How a step turned out, for the small mark in front of its sentence. */
export type Tone = "plain" | "good" | "left_out" | "redo";

export function stepTone(kind: StepKind): Tone {
  if (kind === "match_missing" || kind === "dropped") return "left_out";
  if (kind === "check_failed" || kind === "refused" || kind === "tool_error" || kind === "rewrite_empty") return "redo";
  if (kind === "match_found" || kind === "check_passed" || kind === "kept" || kind === "assembled") return "good";
  return "plain";
}

/** What to say on the error screen for each way a run can fail. */
export function errorSentence(code: ErrorCode): string {
  if (code === "offline") return copy.error_offline;
  if (code === "model_error") return copy.error_model;
  if (code === "timeout") return copy.error_timeout;
  if (code === "nothing_parsed") return copy.error_nothing_parsed;
  if (code === "bot_check") return copy.error_bot_check;
  return copy.error_unknown;
}

// What a field says for each problem it can have.
const PROBLEM_SENTENCE: Partial<Record<ErrorCode | "resume_missing" | "job_missing", string>> = {
  resume_missing: copy.problem_resume_missing,
  resume_too_short: copy.problem_resume_too_short,
  resume_too_long: copy.problem_resume_too_long,
  job_missing: copy.problem_job_missing,
  job_too_short: copy.problem_job_too_short,
  job_too_long: copy.problem_job_too_long,
  file_too_big: copy.problem_file_too_big,
  file_not_pdf: copy.problem_file_not_pdf,
  file_no_text: copy.problem_file_no_text,
  file_unreadable: copy.problem_file_unreadable,
};

export function problemSentence(code: ErrorCode | "resume_missing" | "job_missing"): string {
  return PROBLEM_SENTENCE[code] ?? copy.error_unknown;
}
