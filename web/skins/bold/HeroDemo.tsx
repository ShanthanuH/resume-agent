"use client";

import {
  DEMO_PART,
  DEMO_SPEED,
  DEMO_TOTAL,
  DEMO_TOTAL_SECONDS,
  NO_LINES_KEPT,
  useDemoReplay,
} from "@/components/flow/useDemoReplay";
import { SiteLink } from "@/components/SiteLink";
import { copy, fill } from "@/lib/copy";
import { Clock } from "./flow/Clock";
import { Paper } from "./flow/Paper";
import { ProgressBar } from "./flow/ProgressBar";
import { chapter, page, quietLink } from "./ui";

/**
 * The second chapter of the home page: the recorded run, playing in the same
 * progress bar and on the same white sheet the real flow uses. First the lines
 * as they were written, then the run, then the changed words in lemon, then
 * the original line opening on mint under the first of them. The lines are set
 * large: this gesture is the product, so it gets the room of a headline.
 */
export function HeroDemo() {
  const { stage, running, done, startedAt, phase, sentence, openId, setOpenId, again } = useDemoReplay<HTMLElement>();

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
            <Clock startedAt={startedAt} speed={DEMO_SPEED} fixed={done ? DEMO_TOTAL_SECONDS : undefined} />
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
          result={DEMO_PART}
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
          <p className="font-normal">{fill(copy.home_demo_speed, { time: DEMO_TOTAL, speed: DEMO_SPEED })}</p>
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
