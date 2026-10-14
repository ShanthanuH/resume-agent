// Small pieces of the result screen that every skin needs: words built from
// the result, and the anchor each line of the resume carries.

import { copy, fill } from "./copy";
import { diffWords } from "./diff";
import type { Result } from "./types";

/** The id a resume line carries in the page, so the jump blocks can find it. */
export const lineAnchor = (bulletId: string) => `line-${bulletId}`;

/** The one summary line: how many lines changed, in words that stay true. */
export function summaryOf(result: Result, changed: number): string {
  if (result.bullets.length === 0) return copy.result_summary_none;
  if (changed === 0) return copy.result_summary_all_kept; // the visitor kept every original
  return changed === 1 ? copy.result_summary_one : fill(copy.result_summary_many, { count: changed });
}

/** For each rewritten line: its ID and the first run of words that changed. */
export function changedWords(result: Result): { id: string; words: string }[] {
  return result.bullets.map((bullet) => {
    const original = bullet.replaces ? (result.evidence[bullet.replaces] ?? "") : "";
    const first = diffWords(original, bullet.text).find((piece) => piece.changed);
    return { id: bullet.id, words: first?.text ?? bullet.text };
  });
}
