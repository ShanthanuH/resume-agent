"use client";

import { useId, useMemo } from "react";
import {
  DEMO_PART,
  DEMO_SPEED,
  DEMO_TOTAL,
  useDemoReplay,
} from "@/components/flow/useDemoReplay";
import { SiteLink } from "@/components/SiteLink";
import { copy, fill } from "@/lib/copy";
import { diffWords } from "@/lib/diff";
import { PHASES } from "@/lib/run-machine";
import { Mark, Original } from "../primitives";
import { page, section, textLink } from "../ui";

type Line = (typeof DEMO_PART.sections)[number]["entries"][number]["lines"][number];

/** One line of the excerpt. A changed one is a button that opens the original. */
function TraceLine({ line, done, open, onToggle }: { line: Line; done: boolean; open: boolean; onToggle: () => void }) {
  const panel = useId();
  const bullet = DEMO_PART.bullets.find((b) => b.id === line.bullet_id);
  const pieces = useMemo(() => (bullet ? diffWords(line.original, bullet.text) : []), [bullet, line.original]);

  if (!bullet || !done) return <li className="py-1.5">{line.original}</li>;
  return (
    <li className="py-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className="block min-h-11 w-full text-left sm:min-h-0"
      >
        {pieces.map((piece, index) => (
          <span key={index}>
            {index > 0 && " "}
            {piece.changed ? <Mark sweep>{piece.text}</Mark> : piece.text}
          </span>
        ))}
      </button>
      <div id={panel} className="unfold" data-open={open} inert={!open}>
        <div>
          <Original className="mt-2">
            <p>{line.original}</p>
          </Original>
        </div>
      </div>
    </li>
  );
}

/** The recorded run, playing on a few lines of a made-up resume. */
export function TraceDemo() {
  const { stage, running, done, phase, sentence, openId, setOpenId, again } = useDemoReplay<HTMLElement>();
  const current = done ? PHASES.length : PHASES.indexOf(phase === "fixing" ? "rewriting" : phase);

  return (
    <section className={`${page} ${section}`}>
      <figure ref={stage} aria-label={copy.home_demo_region} className="mx-auto max-w-[44rem]">
        <div className="mb-5 px-1">
          <div className="t-small flex items-center gap-2 text-ink-soft">
            <span aria-hidden className={`h-2 w-2 rounded-full bg-sky ${running ? "breathe" : ""}`} />
            {copy.home_demo_label}
          </div>
          <p className="t-heading mt-2 min-h-[2.5em]" aria-live="polite">
            {sentence}
          </p>
          <div
            role="progressbar"
            aria-label={copy.run_progress_label}
            aria-valuemin={0}
            aria-valuemax={PHASES.length}
            aria-valuenow={current}
            aria-valuetext={sentence}
            className="mt-2 flex gap-1.5"
          >
            {PHASES.map((name, index) => (
              <span
                key={name}
                className={`h-1 flex-1 rounded-full transition-colors duration-[360ms] ease-calm ${index < current ? "bg-sky" : "bg-ink/10"}`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-shell bg-ink/[0.03] p-1.5 ring-1 ring-line">
          <article
            aria-label={copy.home_demo_paper}
            className="min-h-[27rem] rounded-card bg-paper p-6 shadow-soft sm:min-h-[24rem] sm:p-10"
          >
            {DEMO_PART.sections.map((sec) =>
              sec.entries.map((entry, i) => (
                <div key={i}>
                  <div className="flex flex-wrap justify-between gap-x-4">
                    <p className="font-semibold">
                      {entry.title}
                      {entry.title && entry.organization && ", "}
                      {entry.organization}
                    </p>
                    <p className="t-small text-ink-soft">{entry.dates}</p>
                  </div>
                  <ul className="mt-3 ml-5 list-disc marker:text-ink-soft/50">
                    {entry.lines.map((line) => (
                      <TraceLine
                        key={line.evidence_id}
                        line={line}
                        done={done}
                        open={openId === line.bullet_id}
                        onToggle={() => setOpenId(openId === line.bullet_id ? null : line.bullet_id)}
                      />
                    ))}
                  </ul>
                </div>
              )),
            )}
          </article>
        </div>

        <figcaption className="t-small mt-4 space-y-1 px-1 text-ink-soft">
          <p>{fill(copy.home_demo_speed, { time: DEMO_TOTAL, speed: DEMO_SPEED })}</p>
          <div className={done ? "" : "invisible"}>
            <p>{copy.home_demo_hint}</p>
            <p className="flex flex-wrap gap-x-6">
              <button type="button" onClick={again} className={textLink}>
                {copy.home_demo_again}
              </button>
              <SiteLink href="/example" className={textLink}>
                {copy.home_demo_full}
              </SiteLink>
            </p>
          </div>
        </figcaption>
      </figure>
    </section>
  );
}

