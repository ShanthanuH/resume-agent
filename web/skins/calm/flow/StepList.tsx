"use client";

import { useEffect, useRef } from "react";
import { copy } from "@/lib/copy";
import { stepSentence, stepTone, type Tone } from "@/lib/steps";
import type { Step } from "@/lib/types";

// A small mark in front of each sentence. Shapes only, in ink: yellow and
// green are kept for changed words and original lines.
const MARK: Record<Tone, { glyph: string; className: string }> = {
  good: { glyph: "✓", className: "text-ink" },
  left_out: { glyph: "–", className: "text-ink-soft" },
  redo: { glyph: "↻", className: "text-ink-soft" },
  plain: { glyph: "·", className: "text-ink-soft" },
};

const NEAR_BOTTOM_PX = 48; // "the visitor is reading the newest steps"

/** The steps of a run, one plain sentence each, newest at the bottom. */
export function StepList({ steps, id }: { steps: Step[]; id: string }) {
  const box = useRef<HTMLOListElement>(null);
  const shown = steps
    .map((step) => ({ step, sentence: stepSentence(step) }))
    .filter((row): row is { step: Step; sentence: string } => row.sentence !== null);

  // Was the list scrolled to its end before this render? Read during the
  // effect of the previous render, so it describes what the visitor saw.
  const pinned = useRef(true);
  useEffect(() => {
    const list = box.current;
    if (!list) return;
    // Follow new steps only if the visitor has not scrolled up to read older ones.
    if (pinned.current) list.scrollTop = list.scrollHeight;
  }, [shown.length]);

  return (
    <ol
      id={id}
      ref={box}
      onScroll={(event) => {
        const list = event.currentTarget;
        pinned.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
      }}
      className="t-small max-h-72 space-y-2 overflow-y-auto overscroll-contain rounded-field bg-mist p-4 ring-1 ring-line"
    >
      {shown.length === 0 && <li className="text-ink-soft">{copy.run_steps_empty}</li>}
      {shown.map(({ step, sentence }) => {
        const mark = MARK[stepTone(step.kind)];
        return (
          <li key={step.n} className="rise flex gap-2.5">
            <span aria-hidden className={`w-3 shrink-0 text-center font-semibold ${mark.className}`}>
              {mark.glyph}
            </span>
            {/* line-clamp keeps a long resume line to two rows of the list. */}
            <span className="line-clamp-2 min-w-0 break-words">{sentence}</span>
          </li>
        );
      })}
    </ol>
  );
}
