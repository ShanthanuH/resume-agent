"use client";

import { useEffect, useRef, useState } from "react";
import { copy, fill } from "@/lib/copy";
import { EXAMPLE_RUN, excerpt } from "@/lib/example";
import { clock } from "@/lib/format";
import { changedCount } from "@/lib/resume";
import { phaseOf } from "@/lib/run-machine";
import { PHASE_SENTENCE } from "@/lib/steps";
import { Clock } from "./flow/Clock";
import { Paper } from "./flow/Paper";
import { ProgressBar } from "./flow/ProgressBar";
import { useRun } from "./flow/useRun";
import { SiteLink } from "./SiteLink";
import { quietLink } from "./ui";

// The recorded run took about a minute. Nobody watches a landing page for a
// minute, so here it plays 16 times faster and says so. The same recording at
// its real speed is one link away.
const SPEED = 16;
const START_AFTER_MS = 400; // the pause between coming into view and starting
const REVEAL_AFTER_MS = 900; // a beat after the highlights land, then show the gesture
const NO_LINES_KEPT = new Set<string>();

// Three lines of the example resume: a rewritten one, an untouched one and
// another rewritten one. Enough to show both, small enough for a phone.
const PART = excerpt(EXAMPLE_RUN.result, "Experience", 0, [1, 4]);
const FIRST_CHANGED = PART.sections[0]?.entries[0]?.lines.find((line) => line.bullet_id)?.bullet_id ?? null;
// The run's real length, to the nearest second: 63.5 s shows as "1:04".
const TOTAL_SECONDS = Math.round(EXAMPLE_RUN.result.stats.seconds);
const TOTAL = clock(TOTAL_SECONDS);

/**
 * The picture in the hero: the recorded run, playing in the same progress bar
 * and on the same paper the real flow uses. First the lines as they were
 * written, then the run, then the changed words highlighted, then the
 * original line sliding in under the first of them. No paragraph needed.
 */
export function HeroDemo() {
  const { state, startReplay, skip } = useRun({ checkAvailability: false });
  const stage = useRef<HTMLElement>(null);
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
          startReplay({ speed: SPEED });
          // Visitors who asked for less motion get the end result at once.
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) skip();
        }, START_AFTER_MS);
      },
      { threshold: 0.35 }, // about a third of it is on screen
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
    startReplay({ speed: SPEED });
  }

  const phase = phaseOf(running ? state.steps : []);
  const sentence = done
    ? fill(copy.result_summary_many, { count: changedCount(EXAMPLE_RUN.result, NO_LINES_KEPT) })
    : PHASE_SENTENCE[phase];

  return (
    <figure ref={stage} aria-label={copy.home_demo_region} className="w-full">
      {/* The long soft shadow lifts the demo off the page, like a sheet on a desk. */}
      <div className="rounded-2xl border border-rule bg-desk p-3 shadow-[0_32px_64px_-36px_rgb(16_38_31/0.45)] sm:p-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="label flex items-center gap-2">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full bg-ink ${running ? "breathe" : ""}`} />
            {copy.home_demo_label}
          </span>
          {/* Sped up like the run, so it shows the run's real time. At the end
              it stands still on the real length. */}
          <Clock
            startedAt={running ? state.startedAt : null}
            speed={SPEED}
            fixed={done ? TOTAL_SECONDS : undefined}
            className="text-xs text-muted"
          />
        </div>
        {/* Two lines are kept free for the sentence, so a longer one moves nothing. */}
        <p className="mt-3 flex min-h-[2.75em] items-end px-1 pb-2 text-[0.95rem] font-medium leading-snug">
          <span key={sentence} className="enter inline-block">
            {sentence}
          </span>
        </p>
        <div className="px-1 pb-3">
          <ProgressBar phase={phase} finished={done} sentence={sentence} />
        </div>
        <Paper
          result={PART}
          label={copy.home_demo_paper}
          kept={NO_LINES_KEPT}
          pending={!done}
          openId={openId}
          onOpen={setOpenId}
          compact
          // Room for one original line to slide in without the page below moving.
          className="min-h-[24.5rem] sm:min-h-[19.5rem]"
        />
      </div>
      <figcaption className="mt-3 px-1 text-xs text-muted">
        <p>{fill(copy.home_demo_speed, { time: TOTAL, speed: SPEED })}</p>
        {/* Shown once the run has ended. Until then it is invisible but keeps
            its place, so nothing below jumps when it appears. */}
        <div className={`flex flex-wrap items-center justify-between gap-x-4 ${done ? "" : "invisible"}`}>
          <p className="py-1 text-[0.8125rem] text-soft">{copy.home_demo_hint}</p>
          <p className="flex gap-x-4">
            <button type="button" onClick={again} className={quietLink}>
              {copy.home_demo_again}
            </button>
            <SiteLink href="/example" className={quietLink}>
              {copy.home_demo_full}
            </SiteLink>
          </p>
        </div>
      </figcaption>
    </figure>
  );
}
