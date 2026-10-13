import type { Requirement, Result } from "./types";

/**
 * The resume as the PDF endpoint wants it. Every rewrite is in, except the
 * lines in `kept`: bullet IDs where the visitor chose their original.
 */
export function buildDoc(result: Result, kept: Set<string>) {
  const text = new Map(result.bullets.map((b) => [b.id, b.text]));
  return {
    header: result.header,
    links: result.links,
    sections: result.sections.map((section) => ({
      name: section.name,
      entries: section.entries.map((entry) => ({
        title: entry.title,
        organization: entry.organization,
        dates: entry.dates,
        lines: entry.lines.map((line) =>
          line.bullet_id && !kept.has(line.bullet_id)
            ? (text.get(line.bullet_id) ?? line.original)
            : line.original,
        ),
      })),
    })),
  };
}

/** How many lines on the resume differ from what the visitor wrote. */
export function changedCount(result: Result, kept: Set<string>): number {
  return result.bullets.filter((bullet) => !kept.has(bullet.id)).length;
}

/**
 * What the job asks for that the resume does not show at all: no rewritten
 * line covers it and no original line does. Must-haves come first.
 */
export function gaps(result: Result): Requirement[] {
  const missing = result.requirements.filter(
    (req) => req.bullet_ids.length === 0 && req.kept_line_ids.length === 0,
  );
  // sort is stable, so within each group the job post's own order is kept.
  return missing.sort((a, b) => Number(b.priority === "must_have") - Number(a.priority === "must_have"));
}
