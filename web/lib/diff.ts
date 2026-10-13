// A word-level diff between an original resume line and its rewrite.
//
// It answers one question per word of the rewrite: is this word part of what
// both lines share, in the same order? The words that are not are the ones the
// page highlights.
//
// The method is the classic "longest common subsequence": the longest list of
// words that appears in both lines in the same order. Everything outside that
// list is a change. A phrase that only moved is highlighted too, on purpose:
// moving words can change what a sentence claims, so it should draw the eye.
// Resume lines are short (20 to 40 words), so the simple table-based version is
// fast enough and easy to follow.

/** A run of neighbouring words that are all changed, or all unchanged. */
export type Piece = { text: string; changed: boolean };

/** Split a line into words. The spaces between them are not kept. */
function words(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

/**
 * What two words are compared by: lower case, with punctuation at the ends
 * removed. So "caching," equals "caching" and "Added" equals "added": a comma
 * or a capital letter is not a change worth pointing at. The signs % + and #
 * are kept at the end, so "80%" is not "80" and "C++" is not "C".
 */
function key(word: string): string {
  const core = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%+#]+$/gu, "");
  return core || word; // a word that is only punctuation, like "&", is compared as it is
}

/** For each word of `b`: true if it is in the longest common subsequence with `a`. */
function shared(a: string[], b: string[]): boolean[] {
  // table[i][j] = length of the longest common subsequence of a[i..] and b[j..].
  // It is filled from the end, so each cell only needs cells already known.
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  // Walk the table from the start, marking the shared words of b.
  const kept = new Array<boolean>(b.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      kept[j] = true;
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++; // skipping this word of a loses nothing
    } else {
      j++; // this word of b is not shared: it stays marked as changed
    }
  }
  return kept;
}

/**
 * The rewrite, cut into pieces, with `changed` on the words to highlight.
 * Neighbouring words with the same flag are joined into one piece, so a changed
 * phrase is one highlight and not a row of single words. Put a space between
 * pieces when showing them.
 */
export function diffWords(before: string, after: string): Piece[] {
  const list = words(after);
  const kept = shared(words(before).map(key), list.map(key));
  const out: Piece[] = [];
  list.forEach((word, index) => {
    const changed = !kept[index];
    const last = out[out.length - 1];
    if (last && last.changed === changed) last.text += ` ${word}`;
    else out.push({ text: word, changed });
  });
  return out;
}
