"use client";

import { useEffect, useRef } from "react";
import { copy } from "@/lib/copy";
import { stepSentence, stepTone, type Tone } from "@/lib/steps";
import type { Step } from "@/lib/types";

// A small mark in front of each sentence. A shape as well as a shade, so the
// meaning does not depend on seeing colour.
const MARK: Record<Tone, { glyph: string; className: string }> = {
  good: { glyph: "✓", className: "text-yours" },
  left_out: { glyph: "–", className: "text-left-out" },
  redo: { glyph: "↻", className: "text-left-out" },
  plain: { glyph: "·", className: "text-muted" },
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
      // A dark tile on any field: the list reads the same on lemon and on black.
      className="field-tile max-h-72 space-y-2 overflow-y-auto overscroll-contain p-4 text-base"
    >
      {shown.length === 0 && <li className="text-muted">{copy.run_steps_empty}</li>}
      {shown.map(({ step, sentence }, index) => {
        const mark = MARK[stepTone(step.kind)];
        // Steps that arrived together come in one after another, not in a lump:
        // --i is this step's place within its burst (same arrival time).
        let place = 0;
        while (place < index && shown[index - place - 1].step.at === step.at) place++;
        return (
          <li
            key={step.n}
            className="enter flex gap-2.5"
            style={{ "--i": Math.min(place, 10) } as React.CSSProperties}
          >
            <span aria-hidden className={`w-3 shrink-0 text-center font-bold ${mark.className}`}>
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
