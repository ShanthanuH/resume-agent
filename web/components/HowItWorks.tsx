"use client";

import { useState } from "react";
import { copy } from "@/lib/copy";
import { diffWords } from "@/lib/diff";
import { EXAMPLE_RUN } from "@/lib/example";
import { halfLeft, halfRight, primaryButton } from "./ui";

// The three stages, and the short name under each stop of the slider.
const STAGES = [
  { clause: copy.home_how_1, stop: copy.home_how_stop_1 },
  { clause: copy.home_how_2, stop: copy.home_how_stop_2 },
  { clause: copy.home_how_3, stop: copy.home_how_stop_3 },
];
const LAST = STAGES.length - 1;

// What the pieces of interface on the right show: the first two lines of the
// recorded run's job post, and its first rewritten line.
const JOB = EXAMPLE_RUN.jd_text.split("\n").slice(0, 2).join("\n");
const bullet = EXAMPLE_RUN.result.bullets[0];
const original = bullet?.replaces ? (EXAMPLE_RUN.result.evidence[bullet.replaces] ?? "") : "";
const PIECES = bullet ? diffWords(original, bullet.text) : [];

/**
 * "How it works": two fields side by side and one slider that drives both.
 * Left, the current stage in a few large words. Right, the piece of the real
 * interface that belongs to it. Drag the slider, press its arrow keys, or tap
 * a stage name. Nothing here depends on scrolling.
 */
export function HowItWorks() {
  const [stage, setStage] = useState(0);
  // How far along the track the thumb's centre is. The thumb is 2.5rem wide
  // and stays inside the track, so its centre runs from 1.25rem to 100% - 1.25rem.
  const passed = `calc(1.25rem + ${stage / LAST} * (100% - 2.5rem))`;

  return (
    <section className="grid lg:grid-cols-2">
      <div className={`field-recorded ${halfLeft} flex flex-col py-[var(--chapter)]`}>
        {/* The heading is the current stage. aria-live reads it out when it changes. */}
        <h2 aria-live="polite" className="head min-h-[1.9em]">
          <span key={stage} className="enter inline-block">
            {STAGES[stage].clause}
          </span>
        </h2>

        <div className="mt-10 lg:mt-auto lg:pt-16">
          <div className="relative h-12">
            {/* The track, and the part already passed, drawn under the real slider. */}
            <span aria-hidden className="absolute inset-x-0 top-1/2 -mt-1 h-2 bg-black/25" />
            <span aria-hidden className="absolute left-0 top-1/2 -mt-1 h-2 bg-black" style={{ width: passed }} />
            <input
              type="range"
              min={0}
              max={LAST}
              step={1}
              value={stage}
              onChange={(event) => setStage(Number(event.target.value))}
              aria-label={copy.home_how_title}
              aria-valuetext={STAGES[stage].clause}
              className="stages absolute inset-0"
            />
          </div>
          {/* The stage names are buttons too: a tap is easier than a drag. */}
          <div className="flex justify-between">
            {STAGES.map(({ stop }, index) => (
              <button
                key={stop}
                type="button"
                aria-pressed={index === stage}
                onClick={() => setStage(index)}
                className="small min-h-11 font-normal underline-offset-4 aria-pressed:font-bold aria-pressed:underline aria-pressed:decoration-2"
              >
                {stop}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* The piece of interface for the current stage. On a phone it comes first. */}
      <div
        className={`field-ground ${halfRight} flex min-h-[44svh] items-center justify-center py-12 max-lg:order-first lg:min-h-[80svh]`}
      >
        {/* data-ui: a piece of the product's own interface (see Paper.tsx). */}
        <div key={stage} data-ui className="enter flex min-h-56 w-full max-w-[27.5rem] flex-col justify-center">
          {stage === 0 && (
            <div className="field-sheet flex min-h-56 items-center justify-center px-6 text-center">
              <span className="lead font-bold">{copy.flow_drop}</span>
            </div>
          )}
          {stage === 1 && (
            <div className="field-tile min-h-56 p-5">
              <p className="small text-muted">{copy.flow_step_job}</p>
              <p className="mt-2 whitespace-pre-line">{JOB}</p>
            </div>
          )}
          {stage === 2 && (
            <div>
              <p className="field-sheet swoosh p-5 font-medium leading-[1.4]">
                {PIECES.map((piece, index) => (
                  <span key={index}>
                    {index > 0 && " "}
                    {piece.changed ? <mark>{piece.text}</mark> : piece.text}
                  </span>
                ))}
              </p>
              {/* A picture of the button, not a control: the real one is in the flow. */}
              <p className={`${primaryButton} pointer-events-none mt-1 w-full`}>{copy.result_download}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
