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
import { chapter, page, quietLink } from "./ui";

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
 * The second chapter of the home page: the recorded run, playing in the same
 * progress bar and on the same white sheet the real flow uses. First the lines
 * as they were written, then the run, then the changed words in lemon, then
 * the original line opening on mint under the first of them. The lines are set
 * large: this gesture is the product, so it gets the room of a headline.
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
    startReplay({ speed: SPEED });
  }

  const phase = phaseOf(running ? state.steps : []);
  const sentence = done
    ? fill(copy.result_summary_many, { count: changedCount(EXAMPLE_RUN.result, NO_LINES_KEPT) })
    : PHASE_SENTENCE[phase];

  return (
    // One white field, edge to edge: the resume. The run's status sits beside
    // the lines on a wide screen and above them on a phone.
    <section className="field-sheet">
      <figure
        ref={stage}
        aria-label={copy.home_demo_region}
        className={`${page} ${chapter} grid gap-x-10 gap-y-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr]`}
      >
        <div className="lg:col-span-4 lg:col-start-9">
          <div className="small flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span aria-hidden className={`h-2.5 w-2.5 bg-black ${running ? "breathe" : ""}`} />
              {copy.home_demo_label}
            </span>
            {/* Sped up like the run, so it shows the run's real time. At the end
                it stands still on the real length. */}
            <Clock startedAt={running ? state.startedAt : null} speed={SPEED} fixed={done ? TOTAL_SECONDS : undefined} />
          </div>
          {/* Two lines are kept free for the sentence, so a longer one moves nothing. */}
          <p className="lead mt-4 flex min-h-[2.6em] items-end pb-3 font-bold">
            <span key={sentence} className="enter inline-block">
              {sentence}
            </span>
          </p>
          <ProgressBar phase={phase} finished={done} sentence={sentence} />
        </div>
        <Paper
          result={PART}
          label={copy.home_demo_paper}
          kept={NO_LINES_KEPT}
          pending={!done}
          openId={openId}
          onOpen={setOpenId}
          large
          // Room for one original line to open without the page below moving.
          className="min-h-[40rem] sm:min-h-[30rem] lg:col-span-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:min-h-[34rem]"
        />
        <figcaption className="small lg:col-span-4 lg:col-start-9 lg:self-end">
          <p className="font-normal">{fill(copy.home_demo_speed, { time: TOTAL, speed: SPEED })}</p>
          {/* Shown once the run has ended. Until then it is invisible but keeps
              its place, so nothing below jumps when it appears. */}
          <div className={done ? "" : "invisible"}>
            <p className="mt-1 font-bold">{copy.home_demo_hint}</p>
            <p className="flex flex-wrap gap-x-6">
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
    </section>
  );
}
