// The one state machine for a run.
//
//   idle ──(inputs complete)──> ready ──(started)──> running ──> done
//                                                       │
//                                                       ├──> error    (try again)
//                                                       ├──> limited  (today's runs are gone)
//                                                       └──> paused   (live runs are off)
//
// It is a pure function: the same state and event always give the same next
// state, and nothing here touches the network, a timer or the page. That is
// what makes it easy to test (run-machine.test.ts) and easy to reason about.
// The hook in components/flow/useRun.ts does the side effects and feeds
// events in. A live run and a replay send the very same events, which is why
// both look identical on screen.

import { MAX_FILE_BYTES, MAX_JD_CHARS, MAX_RESUME_CHARS, MIN_CHARS } from "./config";
import type { Availability, ErrorCode, Result, Step } from "./types";

/** Where a run's events come from: the backend, or the recorded run. */
export type Source = "live" | "replay";

/** What the visitor has put in so far. */
export type Input = {
  mode: "file" | "text"; // the resume is a PDF, or pasted text
  file: File | null;
  /** Why the chosen file cannot be used. The file is kept so its name can be shown. */
  fileProblem: ErrorCode | null;
  resumeText: string;
  jobText: string;
};

/** A known reason no live run can start, kept so "back" returns to it. */
export type Block = { status: "limited"; scope: "site" | "visitor" } | { status: "paused" };

export type RunState = {
  input: Input;
  block: Block | null;
} & (
  | {
      status: "idle"; // something is still missing
      /** True once the button was pressed, so each field says what it needs. */
      touched: boolean;
      /** A problem only the server could see, shown until the input changes. */
      serverProblem: ErrorCode | null;
    }
  | { status: "ready" } // both inputs are fine: the button starts a run
  | { status: "running"; source: Source; startedAt: number; queued: boolean; steps: Step[] }
  | { status: "done"; source: Source; steps: Step[]; result: Result }
  | { status: "error"; code: ErrorCode }
  | { status: "limited"; scope: "site" | "visitor" }
  | { status: "paused" }
);

export type RunEvent =
  | { type: "file_added"; file: File }
  | { type: "file_removed" }
  | { type: "mode_set"; mode: Input["mode"] }
  | { type: "resume_typed"; text: string }
  | { type: "job_typed"; text: string }
  | { type: "submit_pressed" } // pressed while something is missing
  | { type: "availability"; value: Availability } // the answer from /api/status
  | { type: "started"; source: Source; at: number }
  | { type: "queued" } // another run is ahead of this one
  | { type: "step"; step: Step }
  | { type: "finished"; result: Result }
  | { type: "failed"; code: ErrorCode }
  | { type: "retry" } // from the error screen back to the inputs
  | { type: "reset" }; // start over

export const EMPTY_INPUT: Input = { mode: "file", file: null, fileProblem: null, resumeText: "", jobText: "" };

export const INITIAL: RunState = {
  status: "idle",
  touched: false,
  serverProblem: null,
  input: EMPTY_INPUT,
  block: null,
};

/** Check a chosen file in the browser. Returns the problem, or null if it is fine. */
export function fileProblemOf(file: File): ErrorCode | null {
  // Some browsers give a dragged PDF no type, so the file name is accepted too.
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "file_not_pdf";
  if (file.size > MAX_FILE_BYTES) return "file_too_big";
  return null;
}

/** What is wrong with the resume as entered, or null. "resume_missing" means empty. */
export function resumeProblem(input: Input): ErrorCode | "resume_missing" | null {
  if (input.mode === "file") {
    if (input.fileProblem) return input.fileProblem;
    return input.file ? null : "resume_missing";
  }
  const length = input.resumeText.trim().length;
  if (length === 0) return "resume_missing";
  if (length < MIN_CHARS) return "resume_too_short";
  return length > MAX_RESUME_CHARS ? "resume_too_long" : null;
}

/** What is wrong with the job post as entered, or null. "job_missing" means empty. */
export function jobProblem(input: Input): ErrorCode | "job_missing" | null {
  const length = input.jobText.trim().length;
  if (length === 0) return "job_missing";
  if (length < MIN_CHARS) return "job_too_short";
  return length > MAX_JD_CHARS ? "job_too_long" : null;
}

/** Back at the inputs: "ready" if both are fine, else "idle". */
function editing(input: Input, block: Block | null, touched = false): RunState {
  if (resumeProblem(input) === null && jobProblem(input) === null) {
    return { status: "ready", input, block };
  }
  return { status: "idle", touched, serverProblem: null, input, block };
}

/** The screen a visitor returns to: the block if there is one, else the inputs. */
function home(state: RunState): RunState {
  const { input, block } = state;
  return block ? { ...block, input, block } : editing(input, block);
}

// Server errors that point at one of the two inputs. They send the visitor back
// to the form, where the message sits next to the field it is about.
const FILE_CODES: ErrorCode[] = ["file_too_big", "file_not_pdf", "file_no_text", "file_unreadable"];
const FIELD_CODES: ErrorCode[] = ["resume_too_short", "resume_too_long", "job_too_short", "job_too_long"];

export function reduce(state: RunState, event: RunEvent): RunState {
  const { input, block } = state;
  const isEditing = state.status === "idle" || state.status === "ready";
  const touched = state.status === "idle" && state.touched;

  switch (event.type) {
    // --- The visitor changes an input. Only possible while the form shows. ---
    case "file_added":
      if (!isEditing) return state;
      return editing(
        { ...input, mode: "file", file: event.file, fileProblem: fileProblemOf(event.file) },
        block,
        touched,
      );
    case "file_removed":
      if (!isEditing) return state;
      return editing({ ...input, file: null, fileProblem: null }, block, touched);
    case "mode_set":
      if (!isEditing) return state;
      return editing({ ...input, mode: event.mode }, block, touched);
    case "resume_typed":
      if (!isEditing) return state;
      return editing({ ...input, resumeText: event.text }, block, touched);
    case "job_typed":
      if (!isEditing) return state;
      return editing({ ...input, jobText: event.text }, block, touched);
    case "submit_pressed":
      // Pressed with something missing: from now on the fields say what they need.
      return state.status === "idle" ? { ...state, touched: true } : state;

    // --- /api/status answered. It only matters before a run. ---
    case "availability": {
      if (!isEditing || event.value === "open") return state;
      const next: Block = event.value === "paused" ? { status: "paused" } : { status: "limited", scope: "site" };
      return { ...next, input, block: next };
    }

    // --- A run. ---
    case "started":
      if (state.status === "running") return state; // one run at a time
      // A live run needs complete inputs. The recorded run can start from anywhere.
      if (event.source === "live" && state.status !== "ready") return state;
      return { status: "running", source: event.source, startedAt: event.at, queued: false, steps: [], input, block };
    case "queued":
      return state.status === "running" ? { ...state, queued: true } : state;
    case "step":
      if (state.status !== "running") return state;
      // A step arriving means this run has the slot: it is no longer queued.
      return { ...state, queued: false, steps: [...state.steps, event.step] };
    case "finished":
      if (state.status !== "running") return state;
      return { status: "done", source: state.source, steps: state.steps, result: event.result, input, block };
    case "failed": {
      if (state.status !== "running") return state;
      const { code } = event;
      if (FILE_CODES.includes(code)) {
        // Back to the form with the file marked as unusable.
        return editing({ ...input, fileProblem: code }, block, true);
      }
      if (FIELD_CODES.includes(code)) {
        return { status: "idle", touched: true, serverProblem: code, input, block };
      }
      if (code === "limit_site" || code === "limit_visitor") {
        const next: Block = { status: "limited", scope: code === "limit_site" ? "site" : "visitor" };
        return { ...next, input, block: next };
      }
      if (code === "paused") return { status: "paused", input, block: { status: "paused" } };
      return { status: "error", code, input, block };
    }

    // --- Leaving a screen. ---
    case "retry":
      return state.status === "error" ? editing(input, block) : state;
    case "reset":
      return state.status === "running" ? state : home(state);
  }
}

// --- What to say while a run is going -----------------------------------------

/** The stage a run is in. Each one has a sentence in copy.yaml. */
export type Phase = "reading" | "matching" | "rewriting" | "checking" | "fixing" | "building";

/** The stages in the order the progress bar shows them. "fixing" sits on "rewriting". */
export const PHASES: Phase[] = ["reading", "matching", "rewriting", "checking", "building"];

/** The stage a plan step starts, from the tools it is about to call. */
function phaseOfPlan(calls: Record<string, number>, hadFailedCheck: boolean): Phase | null {
  // One turn can mix tools. The furthest stage wins, so the bar never jumps back
  // for a turn that, say, checks two lines and looks up one more requirement.
  if (calls.assemble_resume) return "building";
  if (calls.verify_claim) return "checking";
  if (calls.rewrite_bullet) return hadFailedCheck ? "fixing" : "rewriting";
  if (calls.search_evidence || calls.reject_requirement) return "matching";
  return null; // only a question or a dropped line: the stage does not change
}

/**
 * Work out the stage from the steps so far.
 *
 * A run goes in turns: a "plan" step says which tools come next and how many
 * calls, then one step arrives per call. While results are still arriving the
 * stage is the plan's. Once they are all in, the run is thinking about its
 * next turn, which takes many seconds, so the stage moves on to what must come
 * next. Without this the sentence would sit on "Finding what matches" for half
 * a minute after the matching was done.
 */
export function phaseOf(steps: Step[]): Phase {
  let phase: Phase = "reading";
  let pending = 0; // results the current plan is still waiting for
  let turn: Step[] = []; // the results of the current plan, so far
  let anyMatch = false; // some line on the resume matched the job
  let hadFailedCheck = false; // a rewrite failed its check at some point

  for (const step of steps) {
    if (step.kind === "read_resume" || step.kind === "read_job") {
      phase = "matching"; // both texts are read: matching is next
      continue;
    }
    if (step.kind === "plan") {
      const calls = step.calls ?? {};
      phase = phaseOfPlan(calls, hadFailedCheck) ?? phase;
      pending = Object.values(calls).reduce((sum, count) => sum + count, 0);
      turn = [];
      continue;
    }
    turn.push(step);
    pending -= 1;
    if (step.kind === "match_found") anyMatch = true;
    if (step.kind === "check_failed") hadFailedCheck = true;
    if (step.kind === "assembled" || step.kind === "assembled_fallback") {
      phase = "building"; // the resume exists: nothing comes after this
      continue;
    }
    if (pending > 0) continue; // more results of this turn are on their way

    // The turn is complete. What has to happen next?
    const kinds = new Set(turn.map((result) => result.kind));
    if (phase === "matching") phase = anyMatch ? "rewriting" : "building";
    else if (phase === "rewriting" || phase === "fixing") phase = kinds.has("rewrote") ? "checking" : "building";
    else if (phase === "checking") phase = kinds.has("check_failed") ? "fixing" : "building";
  }
  return phase;
}
