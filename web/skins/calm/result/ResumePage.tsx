"use client";

import { copy } from "@/lib/copy";
import { diffWords } from "@/lib/diff";
import { lineAnchor } from "@/lib/result-text";
import type { Bullet, Entry, Line, Result } from "@/lib/types";
import { Before, Mark } from "../parts";

/** A contact line without its empty items ("Pune |  | a@b.com" -> "Pune | a@b.com"). */
function cleanContact(line: string): string {
  return line
    .split("|")
    .map((part) => part.trim())
    .filter((part) => /[\p{L}\p{N}_]/u.test(part))
    .join(" | ");
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

type Props = {
  result: Result;
  kept: Set<string>;
  showChanges: boolean;
  openId: string | null;
  onToggle: (bulletId: string) => void;
};

/**
 * The tailored resume as a page, in the PDF's order: name, contact line, then
 * each section with its entries. Arial stands in for the PDF's font.
 */
export function ResumePage({ result, kept, showChanges, openId, onToggle }: Props) {
  const bullets = new Map(result.bullets.map((b) => [b.id, b]));
  const contact = result.header.slice(1).map(cleanContact).filter(Boolean).join(" | ");

  return (
    <article
      aria-label={copy.calm_result_page_label}
      tabIndex={0}
      className="res-page relative flex flex-col gap-3 font-[Arial,Helvetica,sans-serif] text-[14px] leading-[1.5] text-paper-text desk:h-full desk:overflow-y-auto desk:px-[60px] desk:pt-12 desk:pb-[120px] px-5 py-7"
    >
      <header className="flex flex-col gap-1 text-center">
        <span className="text-[26px] font-bold">{result.header[0]}</span>
        {contact && <span className="text-[12px] text-[#4A5260] [overflow-wrap:anywhere]">{contact}</span>}
      </header>
      {result.sections.map((section, s) => (
        <section key={s} className="flex flex-col gap-3">
          <h2 className="mt-2 border-b border-paper-text pb-0.5 text-[13px] font-bold">{section.name}</h2>
          {section.entries.map((entry, e) => (
            <EntryBlock
              key={e}
              entry={entry}
              bullets={bullets}
              kept={kept}
              showChanges={showChanges}
              openId={openId}
              onToggle={onToggle}
            />
          ))}
        </section>
      ))}
    </article>
  );
}

type EntryProps = Omit<Props, "result"> & { entry: Entry; bullets: Map<string, Bullet> };

function EntryBlock({ entry, bullets, kept, showChanges, openId, onToggle }: EntryProps) {
  const heading = Boolean(entry.title || entry.organization);
  // A line that only repeats the entry title adds nothing: the PDF leaves it out.
  const lines = entry.lines.filter((line) => squash(line.original) !== squash(entry.title));
  const rows = lines.map((line, i) => (
    <LineRow
      key={i}
      line={line}
      bullet={line.bullet_id ? bullets.get(line.bullet_id) : undefined}
      kept={kept}
      showChanges={showChanges}
      openId={openId}
      onToggle={onToggle}
      bulleted={heading}
    />
  ));
  return (
    <div className="flex flex-col gap-1.5">
      {(heading || entry.dates) && (
        <div className="flex justify-between gap-4">
          <span>
            {entry.title && <b>{entry.title}</b>}
            {entry.title && entry.organization && ", "}
            {entry.organization}
          </span>
          <span className="shrink-0 text-right">{entry.dates}</span>
        </div>
      )}
      {heading ? <ul className="m-0 flex list-none flex-col gap-2 p-0">{rows}</ul> : rows}
    </div>
  );
}

type RowProps = {
  line: Line;
  bullet: Bullet | undefined;
  kept: Set<string>;
  showChanges: boolean;
  openId: string | null;
  onToggle: (bulletId: string) => void;
  bulleted: boolean;
};

function LineRow({ line, bullet, kept, showChanges, openId, onToggle, bulleted }: RowProps) {
  const rewritten = bullet !== undefined && !kept.has(bullet.id);
  const final = rewritten ? bullet.text : line.original;
  const marked = rewritten && showChanges;
  const open = marked && openId === bullet.id;
  const beforeId = bullet ? `before-${bullet.id}` : undefined;

  const body = marked ? (
    <>
      <button type="button" className="textbtn" aria-expanded={open} aria-controls={beforeId} onClick={() => onToggle(bullet.id)}>
        {diffWords(line.original, bullet.text).map((piece, i) => (
          <span key={i}>
            {i > 0 && " "}
            {piece.changed ? <Mark>{piece.text}</Mark> : piece.text}
          </span>
        ))}
      </button>
      {open && <Before id={beforeId} text={line.original} className="ml-3 mt-1.5 rounded-[10px] px-3 py-2.5 font-sans text-[13px]" />}
    </>
  ) : (
    final
  );

  const id = bullet ? lineAnchor(bullet.id) : undefined;
  if (!bulleted) return <div id={id}>{body}</div>;
  return (
    <li id={id} className="flex gap-2">
      <span aria-hidden>•</span>
      <div className="min-w-0 flex-1">{body}</div>
    </li>
  );
}
