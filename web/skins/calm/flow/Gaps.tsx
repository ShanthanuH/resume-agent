import { copy } from "@/lib/copy";
import type { Requirement } from "@/lib/types";
import { Strike } from "../primitives";

/** What the job asks for and the resume lacks: crossed out, left out on purpose. */
export function Gaps({ missing }: { missing: Requirement[] }) {
  if (missing.length === 0) return null;
  return (
    <section>
      <h2 className="t-heading">{copy.calm_gaps_title}</h2>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {missing.map((req) => (
          <li key={req.id}>
            <Strike>{req.text}</Strike>
          </li>
        ))}
      </ul>
      <p className="t-small mt-3 max-w-[44ch] text-ink-soft">{copy.gaps_text}</p>
    </section>
  );
}
