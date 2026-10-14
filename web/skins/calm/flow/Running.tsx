"use client";

import { copy } from "@/lib/copy";
import { phaseOf, type Source } from "@/lib/run-machine";
import { PHASE_SENTENCE } from "@/lib/steps";
import type { Step } from "@/lib/types";
import { Card } from "../primitives";
import { page, pageTop } from "../ui";
import { Clock } from "./Clock";
import { ProgressBar } from "./ProgressBar";
import { ReplayNote } from "./ReplayNote";
import { StepsToggle } from "./StepsToggle";

export type RunningProps = {
  steps: Step[];
  queued: boolean;
  startedAt: number | null;
  source: Source;
  onSkip: () => void;
  speed: number;
};

/**
 * The wait: one quiet card. A heading says what is happening now, a slim bar
 * shows the stage, the clock ticks, and the steps open on request.
 */
export function Running({ steps, queued, startedAt, source, onSkip, speed }: RunningProps) {
  const phase = phaseOf(steps);
  const sentence = queued ? copy.run_queued : PHASE_SENTENCE[phase];

  return (
    <div className={`${pageTop} pb-20`}>
      {source === "replay" && (
        <div className="mb-6">
          <ReplayNote onSkip={onSkip} />
        </div>
      )}
      <div className={`${page} max-w-[44rem]`}>
        <Card className="rise">
          {/* aria-live: each new sentence is read once. tabIndex lets the flow
              move keyboard focus here when this screen appears. Room for two
              lines is kept, so the bar below never moves. */}
          <h1
            aria-live="polite"
            tabIndex={-1}
            data-focus
            className="t-title min-h-[2.16em] text-[clamp(1.5rem,1.1rem+1.8vw,2.25rem)] focus:outline-none"
          >
            <span key={sentence} className="rise inline-block">
              {sentence}
            </span>
          </h1>
          <div className="mt-8 flex items-center gap-4">
            <ProgressBar phase={phase} sentence={sentence} />
            <Clock startedAt={startedAt} speed={source === "replay" ? speed : 1} className="t-body shrink-0 font-medium text-ink-soft" />
          </div>
          <p className="t-body mt-6 text-ink-soft">{copy.run_hint}</p>
          <div className="mt-2">
            <StepsToggle steps={steps} />
          </div>
        </Card>
      </div>
    </div>
  );
}
