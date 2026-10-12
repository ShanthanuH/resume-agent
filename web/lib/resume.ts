import type { Requirement, Result } from "./types";

/** The resume as the PDF endpoint wants it: accepted bullets in, the rest original. */
export function buildDoc(result: Result, accepted: Set<string>) {
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
          line.bullet_id && accepted.has(line.bullet_id)
            ? (text.get(line.bullet_id) ?? line.original)
            : line.original,
        ),
      })),
    })),
  };
}

export type Coverage = {
  covered: Requirement[]; // a verified line on the final resume covers it
  unshown: Requirement[]; // there is evidence, but its rewrite was rejected
  gaps: Requirement[]; // no evidence on the resume at all
};

/** Sort requirements by what the final resume can honestly show for each. */
export function coverage(requirements: Requirement[], accepted: Set<string>): Coverage {
  const out: Coverage = { covered: [], unshown: [], gaps: [] };
  for (const req of requirements) {
    const hasAccepted = req.bullet_ids.some((id) => accepted.has(id));
    if (hasAccepted || req.kept_line_ids.length > 0) out.covered.push(req);
    else if (req.bullet_ids.length > 0) out.unshown.push(req);
    else out.gaps.push(req);
  }
  return out;
}
