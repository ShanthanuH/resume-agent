"use client";

import { useRef, useState } from "react";
import type { Result } from "@/lib/types";
import { TraceLine } from "./TraceLine";

type Props = {
  result: Result;
  label: string; // the name screen readers announce for the resume
  /** Bullet IDs where the visitor keeps their original line. */
  kept: Set<string>;
  /** True shows every line as first written. The home page uses it before its run ends. */
  pending?: boolean;
  /** The changed line whose original is showing because it was tapped. */
  openId: string | null;
  onOpen: (bulletId: string | null) => void;
  /** Lets the visitor keep an original line. Left out on the home page. */
  onKeep?: (bulletId: string, keep: boolean) => void;
  /** Smaller text and a shorter panel, for the home page demo. */
  compact?: boolean;
  /** Extra classes for the sheet. The demo uses it to reserve its height. */
  className?: string;
};

const HOVER_IN_MS = 90; // a pause, so sweeping the mouse across does not open every line
const HOVER_OUT_MS = 220; // long enough to move from the line into its panel

/**
 * The resume, drawn like the sheet of paper it will print as. Lines the run
 * rewrote are TraceLines: highlighted, and openable to show the original.
 */
export function Paper({
  result,
  label,
  kept,
  pending = false,
  openId,
  onOpen,
  onKeep,
  compact = false,
  className = "",
}: Props) {
  // The line the mouse is over. Kept apart from openId (tapped), so that moving
  // the mouse away never closes a line someone opened on purpose.
  const [hovered, setHovered] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bullets = new Map(result.bullets.map((bullet) => [bullet.id, bullet]));
  const [name, ...contact] = result.header;
  const SectionName = compact ? "p" : "h2"; // see where it is used, below

  // Each changed line's place among the changed lines, top to bottom: 0, 1, 2...
  // The highlights are drawn in that order, one shortly after the other.
  const order = new Map<string, number>();
  for (const section of result.sections) {
    for (const entry of section.entries) {
      for (const line of entry.lines) {
        if (line.bullet_id) order.set(line.bullet_id, order.size);
      }
    }
  }

  function hover(bulletId: string, inside: boolean) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(inside ? bulletId : null), inside ? HOVER_IN_MS : HOVER_OUT_MS);
  }

  return (
    <article
      aria-label={label}
      className={`rounded-md border border-rule bg-sheet shadow-[0_1px_0_var(--color-rule),0_24px_48px_-32px_rgb(21_20_15/0.28)] ${
        compact ? "p-4 text-[0.8125rem] leading-[1.5] sm:p-5" : "p-5 text-[0.9rem] leading-[1.55] sm:p-10 sm:text-[0.95rem]"
      } ${className}`}
    >
      {name && <p className="text-center text-xl font-semibold tracking-tight sm:text-2xl">{name}</p>}
      {contact.length > 0 && (
        <p className="mt-1 break-words text-center text-[0.85em] text-soft">{contact.join(" | ")}</p>
      )}
      {result.sections.map((section) => (
        <section key={section.name} className="mt-5 first:mt-0">
          {/* A real heading on the result, so the resume can be moved through
              by its sections. In the small demo it is only a picture of a
              resume, and a heading there would muddle the page's own outline. */}
          <SectionName className="border-b border-ink pb-1 text-[0.75em] font-semibold uppercase tracking-[0.12em]">
            {section.name}
          </SectionName>
          {section.entries.map((entry, index) => {
            const hasHeading = Boolean(entry.title || entry.organization);
            return (
              <div key={index} className="mt-2.5">
                {(hasHeading || entry.dates) && (
                  <div className="flex flex-wrap justify-between gap-x-4">
                    <p>
                      <span className="font-semibold">{entry.title}</span>
                      {entry.title && entry.organization && ", "}
                      {entry.organization}
                    </p>
                    <p className="text-soft">{entry.dates}</p>
                  </div>
                )}
                {/* A section with no entry heading, like skills, is plain rows. */}
                <ul className={hasHeading ? "ml-[1.1em] list-disc marker:text-muted" : ""}>
                  {entry.lines.map((line) => {
                    const bullet = line.bullet_id ? bullets.get(line.bullet_id) : undefined;
                    if (!bullet || pending) {
                      return (
                        <li key={line.evidence_id} className="mt-1">
                          {line.original}
                        </li>
                      );
                    }
                    return (
                      <TraceLine
                        key={line.evidence_id}
                        bullet={bullet}
                        original={line.original}
                        // What the job asks for that this line shows. The
                        // small demo leaves it out to stay short.
                        asked={
                          compact
                            ? []
                            : result.requirements
                                .filter((req) => bullet.requirement_ids.includes(req.id))
                                .map((req) => req.text)
                        }
                        kept={kept.has(bullet.id)}
                        open={(hovered ?? openId) === bullet.id}
                        order={order.get(bullet.id) ?? 0}
                        onToggle={() => onOpen(openId === bullet.id ? null : bullet.id)}
                        onHover={(inside) => hover(bullet.id, inside)}
                        onKeep={onKeep && ((keep) => onKeep(bullet.id, keep))}
                      />
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
    </article>
  );
}
