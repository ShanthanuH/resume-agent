// The calm running screen shows a run as five plain steps:
//
//   1. Read your resume        (done when a "read_resume" step arrives)
//   2. Read the job post       (done when a "read_job" step arrives)
//   3. Matching your lines     (the "matching" stage of phaseOf)
//   4. Rewriting the lines     (the "rewriting", "checking" and "fixing" stages)
//   5. Building your PDF       (the "building" stage, until the result arrives)
//
// The steps the backend sends are finer than that. This file folds them into
// the five, using the same stage logic as every other skin (phaseOf).

import { phaseOf } from "./run-machine";
import type { Step } from "./types";

export type FiveSteps = {
  /** How many of the five are finished: 0 to 4 while running (5 is the result). */
  done: number;
  /** Lines found on the resume, once step 1 is done. */
  resumeLines: number | null;
  /** Things the job post asks for, once step 2 is done. */
  jobAsks: number | null;
};

/** Fold the steps so far into the five-step view. */
export function fiveSteps(steps: Step[]): FiveSteps {
  const resume = steps.find((step) => step.kind === "read_resume");
  const job = steps.find((step) => step.kind === "read_job");
  const resumeLines = resume ? (resume.count ?? 0) : null;
  const jobAsks = job ? (job.count ?? 0) : null;

  let done = 0;
  if (resume && job) {
    const phase = phaseOf(steps);
    if (phase === "building") done = 4;
    else if (phase === "rewriting" || phase === "checking" || phase === "fixing") done = 3;
    else done = 2;
  } else if (resume || job) {
    done = 1;
  }
  return { done, resumeLines, jobAsks };
}

/**
 * How far the bar is filled, from 0 to 1. Each finished step is a fifth; inside
 * the current step the fill eases towards the next fifth but never reaches it,
 * so the bar keeps moving without promising more than is done. `seconds` is
 * the time spent in the current step. It never reaches 1: the result screen
 * replaces the bar when the PDF is ready.
 */
export function progressOf(done: number, seconds: number): number {
  const EASE_SECONDS = 20; // the time it takes to cover most of a step's fifth
  const inside = 1 - Math.exp(-Math.max(0, seconds) / EASE_SECONDS); // 0 -> 1, never 1
  return Math.min(0.98, (Math.min(done, 4) + 0.9 * inside) / 5);
}
