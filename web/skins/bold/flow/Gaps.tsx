import { copy } from "@/lib/copy";
import type { Requirement } from "@/lib/types";

/**
 * "Not on your resume": what the job asks for and the resume does not show.
 * Orange blocks (orange is the site's colour for "left out"), and one line
 * saying they were left out on purpose. Shows nothing when the resume covers
 * everything.
 */
export function Gaps({ missing }: { missing: Requirement[] }) {
  if (missing.length === 0) return null;
  return (
    <section>
      <h2 className="lead font-bold">{copy.gaps_title}</h2>
      <ul className="mt-3 flex flex-wrap gap-1">
        {missing.map((req) => (
          <li key={req.id} className="field-left-out px-3 py-1.5 font-medium">
            {req.text}
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-[44ch]">{copy.gaps_text}</p>
    </section>
  );
}
