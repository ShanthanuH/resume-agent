"use client";

import { Fragment, useId, useState } from "react";
import { copy, fill } from "@/lib/copy";
import { diffWords } from "@/lib/diff";
import { EXAMPLE_RUN, excerpt } from "@/lib/example";
import { companyLine, jobHeading } from "@/lib/job-heading";
import { Before, Mark } from "../parts";
import { IDS } from "../flow/contracts";

// Which requirements of the recorded run the card shows. They were picked to
// match the design's example: query tuning, Redis and tests were matched, and
// Kafka was not on the resume.
const MATCHED = ["R6", "R7", "R11"];
const MISSING = "R10";

const DOT = "h-[9px] w-[9px] shrink-0 rounded-full wide:h-2.5 wide:w-2.5";

/** The example: the job post's needs on the left, the tailored lines on the right. */
export function Example() {
  const { result, jd_text } = EXAMPLE_RUN;
  const heading = jobHeading(jd_text);
  const company = companyLine(jd_text);
  const need = (id: string) => result.requirements.find((r) => r.id === id)?.text;
  const matched = MATCHED.map(need).filter((t): t is string => Boolean(t));
  const missing = need(MISSING);

  const shown = excerpt(result, "Experience", 0, [1, 4]);
  const entry = shown.sections[0]?.entries[0];
  const base = useId();
  // The first changed line starts open.
  const firstChanged = entry?.lines.find((line) => line.bullet_id)?.evidence_id;
  const [open, setOpen] = useState<Record<string, boolean>>(firstChanged ? { [firstChanged]: true } : {});

  return (
    <section id={IDS.how} className="relative mx-auto box-border max-w-[1200px] scroll-mt-4 px-5 pt-16 pb-10 wide:px-[clamp(20px,4vw,40px)] wide:pt-[110px] wide:pb-[70px]">
      <h2 className="m-0 font-serif text-[40px] leading-[1.02] font-normal wide:text-[clamp(38px,4.4vw,60px)] wide:tracking-[-0.5px]">{copy.calm_home_example_title}</h2>
      <p className="mt-3 mb-0 max-w-[620px] text-[16px] leading-[1.55] text-ink-700 wide:mt-3.5 wide:text-[18px]">{copy.calm_home_example_lead}</p>
      <div className="glass example-glass mt-3.5 flex flex-col gap-3 rounded-[26px] p-3 wide:mt-9 wide:grid wide:grid-cols-2 wide:items-start wide:gap-7 wide:rounded-[30px] wide:p-[26px]">
        <div className="field flex flex-col gap-2.5 rounded-[18px] p-[18px] wide:gap-3.5 wide:rounded-[20px] wide:p-6">
          <span className="text-[12px] font-semibold text-ink-500 wide:text-[13px]">{copy.calm_example_job_label}</span>
          <div className="flex flex-col gap-1">
            <span className="font-serif text-[26px] leading-[1.1] wide:text-[30px]">{heading?.title}</span>
            {company && <span className="text-[13px] text-ink-500 wide:text-[14px]">{company}</span>}
          </div>
          <span className="mt-1.5 hidden text-[14px] font-semibold text-ink-700 wide:block">{copy.calm_example_asks}</span>
          <ul className="m-0 mt-1 flex list-none flex-col gap-2 p-0 text-[15px] wide:mt-0 wide:gap-2.5 wide:text-[16px]">
            {matched.map((text) => (
              <li key={text} className="flex items-center gap-2.5">
                <span aria-hidden className={`${DOT} bg-ink-900`} />
                {text}
              </li>
            ))}
            {missing && (
              <li className="flex items-center gap-2.5 text-ink-500">
                <span aria-hidden className={`${DOT} box-border border-[1.5px] border-ink-500`} />
                <span>
                  <span className="line-through decoration-strike decoration-2">{missing}</span>
                  {copy.calm_example_missing}
                </span>
              </li>
            )}
          </ul>
        </div>
        {entry && (
          <div className="flex flex-col gap-3 rounded-[18px] bg-white p-[18px] text-[15px] leading-[1.55] text-paper-text shadow-[0_14px_30px_rgba(16,44,80,0.12)] wide:gap-3.5 wide:rounded-[20px] wide:px-7 wide:py-[26px] wide:text-[16px] wide:shadow-[0_18px_40px_rgba(16,44,80,0.12)]">
            <div className="flex flex-wrap justify-between gap-3">
              <span>
                <b>{entry.title}</b>, {entry.organization}
              </span>
              <span className="hidden text-paper-muted wide:inline">{entry.dates}</span>
            </div>
            {entry.lines.map((line) => {
              const bullet = line.bullet_id ? result.bullets.find((b) => b.id === line.bullet_id) : undefined;
              if (!bullet) return <div key={line.evidence_id}>{line.original}</div>;
              const isOpen = Boolean(open[line.evidence_id]);
              const boxId = `${base}-${line.evidence_id}`;
              const pieces = diffWords(line.original, bullet.text);
              return (
                <div key={line.evidence_id} className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="textbtn"
                    aria-expanded={isOpen}
                    aria-controls={boxId}
                    onClick={() => setOpen((o) => ({ ...o, [line.evidence_id]: !o[line.evidence_id] }))}
                  >
                    {pieces.map((piece, i) => (
                      <Fragment key={i}>
                        {i > 0 && " "}
                        {piece.changed ? <Mark>{piece.text}</Mark> : piece.text}
                      </Fragment>
                    ))}
                  </button>
                  <div id={boxId} hidden={!isOpen}>
                    <Before text={line.original} className="px-3 py-2.5 text-[13px] leading-[1.5] wide:px-3.5 wide:py-3 wide:text-[14px]" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="m-0 px-1.5 pt-0.5 pb-1.5 text-[14px] text-ink-700 wide:col-span-full wide:px-1 wide:pt-1 wide:pb-0 wide:text-[15px]">
          {fill(copy.calm_home_example_count, { count: result.bullets.length })}
        </p>
      </div>
    </section>
  );
}
