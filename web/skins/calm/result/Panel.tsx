"use client";

import { useId } from "react";
import { copy, fill } from "@/lib/copy";
import { gaps } from "@/lib/resume";
import type { Bullet, Result } from "@/lib/types";
import { DownloadIcon, Glass, Struck, Switch } from "../parts";

/** The start of a line, cut at a word boundary: about 60 characters, then "…". */
function start(text: string): string {
  if (text.length <= 60) return text;
  const cut = text.slice(0, 60);
  const space = cut.lastIndexOf(" ");
  return `${(space > 30 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

type SummaryProps = {
  result: Result;
  title: string;
  company: string | null;
  changed: number;
  showChanges: boolean;
  onShowChanges: (on: boolean) => void;
};

/** "Tailored for", the job, the count and the "Show changes" switch. */
export function Summary({ result, title, company, changed, showChanges, onShowChanges }: SummaryProps) {
  const labelId = useId();
  const none = result.bullets.length === 0;
  return (
    <Glass tone="photo" className="res-flat order-1 flex flex-col gap-[14px] rounded-[22px] p-5 desk:gap-[18px]">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-ink-500">{copy.calm_result_for}</span>
        <span className="font-serif text-[28px] leading-[1.1]">{title}</span>
        {company && <span className="text-[14px] text-ink-500">{company}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <h1 tabIndex={-1} data-focus className="font-serif text-[36px] leading-none font-normal outline-none desk:text-[46px]">
          {none
            ? copy.calm_result_none_title
            : changed === 1
              ? copy.calm_result_count_one
              : fill(copy.calm_result_count_many, { count: changed })}
        </h1>
        <p className="text-[15px] text-ink-700">{none ? copy.calm_result_none_body : copy.calm_result_same}</p>
      </div>
      {!none && (
        <div className="flex items-center justify-between">
          <span id={labelId} className="text-[15px] font-semibold">
            {copy.calm_result_show_changes}
          </span>
          <span className="hidden desk:block">
            <Switch checked={showChanges} onChange={onShowChanges} labelledBy={labelId} size="large" />
          </span>
          <span className="desk:hidden">
            <Switch checked={showChanges} onChange={onShowChanges} labelledBy={labelId} />
          </span>
        </div>
      )}
    </Glass>
  );
}

type CardsProps = {
  bullets: Bullet[];
  kept: Set<string>;
  onJump: (id: string) => void;
  onKeep: (id: string, keep: boolean) => void;
};

/** One small card per rewritten line, with "Keep my original" (and its undo). */
export function ChangeCards({ bullets, kept, onJump, onKeep }: CardsProps) {
  if (bullets.length === 0) return null;
  return (
    <ul className="order-3 m-0 flex list-none flex-col gap-2.5 p-0">
      {bullets.map((bullet) => {
        const isKept = kept.has(bullet.id);
        return (
          <li key={bullet.id} className="flex flex-col gap-2.5 rounded-[18px] border border-white/80 bg-white/55 px-4 py-3.5">
            <button type="button" onClick={() => onJump(bullet.id)} className="textbtn min-h-11 text-[14px] leading-normal">
              {start(bullet.text)}
            </button>
            <button
              type="button"
              onClick={() => onKeep(bullet.id, !isKept)}
              className="glass glass-photo lift min-h-11 self-start rounded-full px-[14px] py-2 text-[13px] font-semibold text-ink-900"
            >
              {isKept ? copy.calm_result_use_new : copy.calm_result_keep}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The skills the job asks for that the resume does not show. */
export function Missing({ result }: { result: Result }) {
  const missing = gaps(result);
  return (
    <Glass tone="photo" className="res-flat order-4 flex flex-col gap-2 rounded-[22px] p-5">
      <span className="text-[13px] font-semibold text-ink-500">{copy.calm_missing_label}</span>
      {missing.length === 0 ? (
        <span className="text-[15px] text-ink-700">{copy.calm_result_no_missing}</span>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-[22px] gap-y-0.5">
          {missing.map((req, i) => (
            <Struck key={req.id} word={req.text} index={i} className="text-[28px] [--strike-h:2.5px]" />
          ))}
        </div>
      )}
    </Glass>
  );
}

/** What the run wanted to ask the visitor. It never guesses: it asks. */
export function Questions({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;
  return (
    <Glass tone="photo" className="res-flat order-4 flex flex-col gap-2 rounded-[22px] p-5">
      <h2 className="text-[13px] font-semibold text-ink-500">
        {questions.length === 1 ? copy.questions_title_one : copy.questions_title_many}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[14px] font-medium">
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
      <p className="text-[13px] text-ink-500">{copy.questions_text}</p>
    </Glass>
  );
}

type DownloadProps = {
  state: "idle" | "working" | "failed";
  /** A ready-made PDF, used while no line is kept. */
  staticPdf?: string;
  onDownload: () => void;
};

const buttonClass =
  "ink flex h-14 w-full items-center justify-center gap-2.5 rounded-[18px] font-sans text-[16px] font-bold no-underline";

/** The big "Download PDF" button. On narrow screens it sits in a bar that sticks to the bottom. */
export function DownloadBar({ state, staticPdf, onDownload }: DownloadProps) {
  const working = state === "working";
  return (
    <Glass tone="photo" className="res-bar res-flat order-5 flex flex-col gap-2">
      {staticPdf ? (
        <a href={staticPdf} download={copy.result_file_name} className={buttonClass}>
          <DownloadIcon />
          {copy.calm_result_download}
        </a>
      ) : (
        <button type="button" disabled={working} onClick={onDownload} className={buttonClass}>
          <DownloadIcon />
          {working ? copy.calm_result_busy : copy.calm_result_download}
        </button>
      )}
      <p role="status" className="m-0 text-center text-[13px] text-ink-900 empty:hidden">
        {state === "failed" ? copy.calm_result_pdf_failed : null}
      </p>
    </Glass>
  );
}
