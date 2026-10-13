"use client";

import { copy } from "@/lib/copy";
import { phaseOf, type Source } from "@/lib/run-machine";
import { PHASE_SENTENCE, stepSentence } from "@/lib/steps";
import type { Step } from "@/lib/types";
import { chapter, page } from "../ui";
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

/** The newest step that has a sentence, or "" before there is one. */
function latestOf(steps: Step[]): string {
  for (let index = steps.length - 1; index >= 0; index--) {
    const sentence = stepSentence(steps[index]);
    if (sentence) return sentence;
  }
  return "";
}

/**
 * The wait: one whole screen of lemon, the colour of a changed word, because
 * changing words is what is going on. One large sentence says what is
 * happening, a row of blocks shows the stage, the clock ticks, and under them
 * the newest step is shown as it arrives: a run takes a minute or two, and
 * watching it check each line is the most convincing thing the product does.
 */
export function Running({ steps, queued, startedAt, source, onSkip, speed = 1 }: Props) {
  const phase = phaseOf(steps);
  const sentence = queued ? copy.run_queued : PHASE_SENTENCE[phase];
  const latest = latestOf(steps);

  return (
    <>
      {source === "replay" && <ReplayNote onSkip={onSkip} />}
      <section className="field-changed">
        <div className={`${page} ${chapter} flex min-h-[72svh] flex-col justify-end`}>
          {/* aria-live="polite" makes screen readers read each new sentence once,
              without cutting off what they were saying. tabIndex lets the flow
              move keyboard focus here when this screen appears. */}
          {/* Room for two lines is kept, and the sentence sits at the bottom of it:
              a longer sentence grows upwards and the blocks below never move. */}
          <h1
            aria-live="polite"
            tabIndex={-1}
            data-focus
            className="statement flex min-h-[2.1em] items-end text-[clamp(1.5rem,0.9rem+3.3vw,4.25rem)]"
          >
            {/* The key makes React treat each sentence as a new element, so the
                entrance animation plays every time the sentence changes. */}
            <span key={sentence} className="enter inline-block">
              {sentence}
            </span>
          </h1>
          <div className="mt-8 flex items-center gap-4">
            <ProgressBar phase={phase} sentence={sentence} />
            {/* The clock shows the run's own time. For a live run that is simply ours. */}
            <Clock startedAt={startedAt} speed={source === "replay" ? speed : 1} className="lead font-bold" />
          </div>
          {/* The newest step, for the eye only: screen readers get the sentence
              above and the full list below, and would otherwise hear this twice.
              Two lines are kept free so a long step moves nothing. */}
          <p aria-hidden className="lead mt-6 min-h-[2.6em]">
            <span key={latest} className="enter line-clamp-2">
              {latest}
            </span>
          </p>
          <p className="small mt-4">{copy.run_hint}</p>
          <div className="mt-2">
            <StepsToggle steps={steps} />
          </div>
        </div>
      </section>
    </>
  );
}
