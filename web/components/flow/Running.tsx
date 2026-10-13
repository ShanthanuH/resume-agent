"use client";

import { copy } from "@/lib/copy";
import { phaseOf, type Source } from "@/lib/run-machine";
import { PHASE_SENTENCE } from "@/lib/steps";
import type { Step } from "@/lib/types";
import { Clock } from "./Clock";
import { ProgressBar } from "./ProgressBar";
import { ReplayNote } from "./ReplayNote";
import { StepsToggle } from "./StepsToggle";

type Props = {
  steps: Step[];
  queued: boolean; // another visitor's run is ahead of this one
  startedAt: number | null; // null before the run has begun
  source: Source;
  onSkip?: () => void; // a recorded run can be skipped to its end
  /** How fast a recorded run is playing. The clock runs that much faster too. */
  speed?: number;
};

/**
 * The wait. One sentence that says what is happening, one quiet progress bar,
 * and the time so far. A run takes a minute or two, so the screen has to feel
 * alive without shouting: the bar breathes, the clock ticks, nothing else moves.
 */
export function Running({ steps, queued, startedAt, source, onSkip, speed = 1 }: Props) {
  const phase = phaseOf(steps);
  const sentence = queued ? copy.run_queued : PHASE_SENTENCE[phase];

  return (
    <section className="mx-auto w-full max-w-xl">
      {source === "replay" && <ReplayNote onSkip={onSkip} />}
      {/* aria-live="polite" makes screen readers read each new sentence once,
          without cutting off what they were saying. tabIndex lets the flow
          move keyboard focus here when this screen appears. */}
      {/* Room for two lines is kept, and the sentence sits at the bottom of it:
          a longer sentence grows upwards and the bar below never moves. */}
      <h1
        aria-live="polite"
        tabIndex={-1}
        data-focus
        className="display flex min-h-[2.2em] items-end text-[2rem] sm:text-[2.5rem]"
      >
        {/* The key makes React treat each sentence as a new element, so the
            entrance animation plays every time the sentence changes. */}
        <span key={sentence} className="enter inline-block">
          {sentence}
        </span>
      </h1>
      <div className="mt-6 flex items-center gap-4">
        <ProgressBar phase={phase} sentence={sentence} />
        {/* The clock shows the run's own time. For a live run that is simply ours. */}
        <Clock startedAt={startedAt} speed={source === "replay" ? speed : 1} className="text-sm text-soft" />
      </div>
      <p className="mt-4 text-sm text-muted">{copy.run_hint}</p>
      <div className="mt-6">
        <StepsToggle steps={steps} />
      </div>
    </section>
  );
}
