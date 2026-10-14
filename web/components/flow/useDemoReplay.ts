"use client";

import { useEffect, useRef, useState } from "react";
import { copy, fill } from "@/lib/copy";
import { EXAMPLE_RUN, excerpt } from "@/lib/example";
import { clock } from "@/lib/format";
import { changedCount } from "@/lib/resume";
import { phaseOf } from "@/lib/run-machine";
import { PHASE_SENTENCE } from "@/lib/steps";
import { useRun } from "./useRun";

// The recorded run took about a minute. Nobody watches a landing page for a
// minute, so the home page demo plays it 16 times faster and says so. The
// same recording at its real speed is one link away.
export const DEMO_SPEED = 16;
const START_AFTER_MS = 400; // the pause between coming into view and starting
const REVEAL_AFTER_MS = 900; // a beat after the highlights land, then show the gesture
export const NO_LINES_KEPT = new Set<string>();

// Three lines of the example resume: a rewritten one, an untouched one and
// another rewritten one. Enough to show both, small enough for a phone.
export const DEMO_PART = excerpt(EXAMPLE_RUN.result, "Experience", 0, [1, 4]);
const FIRST_CHANGED = DEMO_PART.sections[0]?.entries[0]?.lines.find((line) => line.bullet_id)?.bullet_id ?? null;
// The run's real length, to the nearest second: 63.5 s shows as "1:04".
export const DEMO_TOTAL_SECONDS = Math.round(EXAMPLE_RUN.result.stats.seconds);
export const DEMO_TOTAL = clock(DEMO_TOTAL_SECONDS);

/**
 * The home page demo, for any skin: the recorded run, played fast once its box
 * scrolls into view, then the first changed line opens by itself. Put `stage`
 * on the box that should start it.
 */
export function useDemoReplay<T extends HTMLElement>() {
  const { state, startReplay, skip } = useRun({ checkAvailability: false });
  const stage = useRef<T>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const running = state.status === "running";
  const done = state.status === "done";

  // Start when the demo scrolls into view, once. On a phone it sits below the
  // headline, and starting earlier would play it to an empty room.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        watcher.disconnect(); // once is enough
        // A beat after it comes into view: the eye lands first, then it moves.
        // It also lets the page finish loading before the animation asks for work.
        timer = setTimeout(() => {
          startReplay({ speed: DEMO_SPEED });
          // Visitors who asked for less motion get the end result at once.
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) skip();
        }, START_AFTER_MS);
      },
      { threshold: 0.1 }, // its top part is on screen (it is taller than a phone)
    );
    watcher.observe(element);
    return () => {
      watcher.disconnect();
      clearTimeout(timer);
    };
  }, [startReplay, skip]);

  // When the run ends, show the gesture itself: open the first changed line.
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setOpenId(FIRST_CHANGED), REVEAL_AFTER_MS);
    return () => clearTimeout(timer);
  }, [done]);

  function again() {
    setOpenId(null);
    startReplay({ speed: DEMO_SPEED });
  }

  const phase = phaseOf(running ? state.steps : []);
  const sentence = done
    ? fill(copy.result_summary_many, { count: changedCount(EXAMPLE_RUN.result, NO_LINES_KEPT) })
    : PHASE_SENTENCE[phase];
  const startedAt = state.status === "running" ? state.startedAt : null;

  return { stage, running, done, startedAt, phase, sentence, openId, setOpenId, again };
}
