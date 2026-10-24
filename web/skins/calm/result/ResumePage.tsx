"use client";

import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import { diffWords } from "@/lib/diff";
import { headerLines, styledPieces } from "@/lib/marks";
import { lineAnchor } from "@/lib/result-text";
import type { Bullet, Entry, Line, Mark as TextMark, Result } from "@/lib/types";
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

/** Bold and italic words of a line, as the PDF prints them. */
function Styled({ text, marks }: { text: string; marks?: TextMark[] }) {
  return (
    <>
      {styledPieces(text, marks).map((piece, i) => {
        const inner = piece.italic ? <i>{piece.text}</i> : piece.text;
        return piece.bold ? <b key={i}>{inner}</b> : <span key={i}>{inner}</span>;
      })}
    </>
  );
}

/**
 * An entry: its header lines as printed (left text, and dates or a place on
 * the right that never wrap), then its lines. Sentences of one paragraph (the
 * summary) run together; bullets get a bullet; other lines stand alone.
 */
function EntryBlock({ entry, bullets, kept, showChanges, openId, onToggle }: EntryProps) {
  const header = headerLines(entry);
  const saved = entry.lines.some((line) => line.kind === undefined); // a run saved before kinds existed
  const headed = Boolean(entry.title || entry.organization);
  // In an older run, a line that only repeats the entry title adds nothing: the PDF leaves it out.
  const lines = saved ? entry.lines.filter((line) => squash(line.original) !== squash(entry.title)) : entry.lines;
  const kindOf = (line: Line) => line.kind ?? (headed ? "bullet" : "line");
  const row = (line: Line, i: number, inline = false) => (
    <LineRow
      key={i}
      line={line}
      bullet={line.bullet_id ? bullets.get(line.bullet_id) : undefined}
      kept={kept}
      showChanges={showChanges}
      openId={openId}
      onToggle={onToggle}
      kind={inline ? "sentence" : kindOf(line)}
    />
  );

  // Group the lines: a run of bullets is one list, a paragraph is one block.
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length; ) {
    const kind = kindOf(lines[i]);
    let end = i + 1;
    if (kind === "bullet") {
      while (end < lines.length && kindOf(lines[end]) === "bullet") end++;
      blocks.push(
        <ul key={i} className="m-0 flex list-none flex-col gap-2 p-0">
          {lines.slice(i, end).map((line, j) => row(line, i + j))}
        </ul>,
      );
    } else if (kind === "sentence") {
      while (end < lines.length && kindOf(lines[end]) === "sentence" && lines[end].join) end++;
      // A div, not a p: an opened "Before" box inside it is a block.
      blocks.push(
        <div key={i}>
          {lines.slice(i, end).map((line, j) => (
            <span key={i + j}>
              {j > 0 && " "}
              {row(line, i + j, true)}
            </span>
          ))}
        </div>,
      );
    } else {
      blocks.push(row(lines[i], i));
    }
    i = end;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {header.length > 0 && (
        <div className="flex flex-col">
          {header.map((line, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span className="min-w-0">
                <Styled text={line.left.text} marks={line.left.marks} />
              </span>
              <span className="shrink-0 whitespace-nowrap text-right">
                <Styled text={line.right.text} marks={line.right.marks} />
              </span>
            </div>
          ))}
        </div>
      )}
      {blocks}
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
  kind: "bullet" | "line" | "sentence" | "fixed";
};

function LineRow({ line, bullet, kept, showChanges, openId, onToggle, kind }: RowProps) {
  const rewritten = bullet !== undefined && !kept.has(bullet.id);
  const marked = rewritten && showChanges;
  const open = marked && openId === bullet.id;
  const beforeId = bullet ? `before-${bullet.id}` : undefined;
  // An unchanged line keeps its bold and italic words. A rewrite shows plain,
  // or with its changed words marked.
  const final = rewritten ? bullet.text : <Styled text={line.original} marks={line.marks} />;

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
  if (kind === "sentence") return <span id={id}>{body}</span>;
  if (kind !== "bullet") return <div id={id}>{body}</div>;
  return (
    <li id={id} className="flex gap-2">
      <span aria-hidden>•</span>
      <div className="min-w-0 flex-1">{body}</div>
    </li>
  );
}
