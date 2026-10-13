import { copy } from "@/lib/copy";
import type { Requirement } from "@/lib/types";

/**
 * "Not on your resume": what the job asks for and the resume does not show.
 * Small chips, and one line saying they were left out on purpose. Shows
 * nothing when the resume covers everything.
 */
export function Gaps({ missing }: { missing: Requirement[] }) {
  if (missing.length === 0) return null;
  return (
    <section>
      <h2 className="label">{copy.gaps_title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {missing.map((req) => (
          <li key={req.id} className="rounded-full border border-rule bg-sheet px-3 py-1 text-sm">
            {req.text}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-soft">{copy.gaps_text}</p>
    </section>
  );
}
