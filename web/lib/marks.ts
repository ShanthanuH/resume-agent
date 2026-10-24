// Bold and italic words inside a line, found the way the backend finds them
// (src/resume_agent/structure.py, mark_pattern): the n-th whole-word match.

import type { Entry, HeaderLine, Mark } from "./types";

export type Piece = { text: string; bold: boolean; italic: boolean };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordChar = /[\p{L}\p{N}_]/u;

/** Finds `anchor` as whole words: "live" in "(live," but not in "delivered". */
function pattern(anchor: string): RegExp {
  const start = wordChar.test(anchor.slice(0, 1)) ? "(?<![\\p{L}\\p{N}_])" : "";
  const end = wordChar.test(anchor.slice(-1)) ? "(?![\\p{L}\\p{N}_])" : "";
  return new RegExp(start + escape(anchor) + end, "gu");
}

/** The text cut into pieces, each bold, italic, both or neither. */
export function styledPieces(text: string, marks: Mark[] = []): Piece[] {
  const bold = new Array<boolean>(text.length).fill(false);
  const italic = new Array<boolean>(text.length).fill(false);
  for (const mark of marks) {
    if (!mark.text || (!mark.bold && !mark.italic)) continue;
    const match = [...text.matchAll(pattern(mark.text))][mark.n];
    if (match?.index === undefined) continue;
    for (let i = match.index; i < match.index + mark.text.length; i++) {
      bold[i] ||= mark.bold;
      italic[i] ||= mark.italic;
    }
  }
  const pieces: Piece[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = pieces[pieces.length - 1];
    if (last && last.bold === bold[i] && last.italic === italic[i]) last.text += text[i];
    else pieces.push({ text: text[i], bold: bold[i], italic: italic[i] });
  }
  return pieces;
}

const plain = (text: string) => ({ text, marks: [] });

/**
 * The entry header as printed. A run saved before header lines existed has
 * only the fields: then it is organisation and dates, then title and location,
 * as the PDF draws it.
 */
export function headerLines(entry: Entry): HeaderLine[] {
  if (entry.header_lines?.length) return entry.header_lines;
  const [first, second] = entry.organization ? [entry.organization, entry.title] : [entry.title, ""];
  const lines: HeaderLine[] = [];
  const styled = (text: string, how: "bold" | "italic") => ({
    text,
    marks: text ? [{ text, n: 0, bold: how === "bold", italic: how === "italic", url: null }] : [],
  });
  if (first || entry.dates) lines.push({ left: styled(first, "bold"), right: plain(entry.dates) });
  if (second || entry.location) lines.push({ left: styled(second, "italic"), right: styled(entry.location ?? "", "italic") });
  return lines;
}
