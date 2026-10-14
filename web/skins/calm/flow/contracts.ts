// The props of each calm screen. Flow.tsx (the container) owns the run and
// passes these down; each screen only draws. Change a shape here and both
// sides must follow.

import type { Dispatch, ReactNode } from "react";
import type { JobHeading } from "@/lib/job-heading";
import type { RunEvent, RunState, Source } from "@/lib/run-machine";
import type { ErrorCode, Result, Step } from "@/lib/types";

/** Ids that more than one screen needs. */
export const IDS = {
  /** The box around the hero form. "Tailor my resume" buttons scroll here. */
  start: "start",
  /** The drop area of the form. "Tailor my resume" buttons focus it. */
  drop: "resume-drop",
  /** The job post box. "Try another job post" focuses it. */
  job: "job-post",
  /** The example section of the landing page. "See how it works" scrolls here. */
  how: "how",
} as const;

/** The hero form: the real input of a run. */
export type HeroFormProps = {
  state: Extract<RunState, { status: "idle" | "ready" }>;
  dispatch: Dispatch<RunEvent>;
  onSubmit: () => void;
  onToken: (token: string) => void;
  /** The button was pressed before the bot check finished: the run starts by itself. */
  waiting: boolean;
};

/** The landing page. The hero's card is the form, or a notice in its place. */
export type LandingProps = {
  heroCard: ReactNode;
  /** The sections under the hero, drawn on the server. Null on /try: the hero only. */
  sections: ReactNode;
  /** The "Free, no sign up" line under the card: only under the form. */
  facts: boolean;
};

/** The screen around the running card (and around an error card). */
export type RunningScreenProps = {
  /** The glass card to show: the progress, or a notice. */
  children: ReactNode;
  /** A note at the top of the screen (the recorded-run page has one). */
  note?: ReactNode;
};

export type RunningCardProps = {
  steps: Step[];
  /** Another run is ahead of this one. */
  queued: boolean;
  /** When the run started, as a Date.now() value. */
  startedAt: number;
  source: Source;
  /** How fast a replay plays: the clock runs this much faster too. */
  speed: number;
  /** Jump a replay to its end. Does nothing for a live run. */
  onSkip: () => void;
};

/** Why no run is going: today's runs are gone, runs are off, or one failed. */
export type NoticeCardProps =
  | { kind: "limited"; onWatch: () => void }
  | { kind: "paused"; onWatch: () => void }
  | { kind: "error"; code: ErrorCode; onRetry: () => void };

export type ResultViewProps = {
  result: Result;
  source: Source;
  /** The job's title and company, read from the job post, or null. */
  job: JobHeading | null;
  /** A ready-made PDF with every rewrite in. The recorded run has one. */
  staticPdf?: string;
  /** Back to the form, with the resume kept and the job post empty. */
  onTryAnother: () => void;
  /** A note at the top of the screen (the recorded-run page has one). */
  note?: ReactNode;
};
