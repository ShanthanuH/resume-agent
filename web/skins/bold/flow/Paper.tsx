"use client";

import { useRef, useState } from "react";
import type { Result } from "@/lib/types";
import { lineAnchor, TraceLine } from "./TraceLine";

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
  /** The home page demo: a few lines set large, with no padding of their own. */
  large?: boolean;
  /** Extra classes for the sheet. The demo uses it to reserve its height. */
  className?: string;
};

const HOVER_IN_MS = 90; // a pause, so sweeping the mouse across does not open every line
const HOVER_OUT_MS = 220; // long enough to move from the line into its panel

/**
 * The resume: black text on white, the one white field on the site. Lines the
 * run rewrote are TraceLines: highlighted, and openable to show the original.
 */
export function Paper({
  result,
  label,
  kept,
  pending = false,
  openId,
  onOpen,
  onKeep,
  large = false,
  className = "",
}: Props) {
  // The line the mouse is over. Kept apart from openId (tapped), so that moving
  // the mouse away never closes a line someone opened on purpose.
  const [hovered, setHovered] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bullets = new Map(result.bullets.map((bullet) => [bullet.id, bullet]));
  const [name, ...contact] = result.header;
  const SectionName = large ? "p" : "h2"; // see where it is used, below

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
      // data-ui marks the home page's excerpt as a picture of the product's
      // interface, for the design inspector (taste-skill). The full resume on
      // the result page is the page itself, not a picture of it.
      data-ui={large ? "" : undefined}
      className={`field-sheet ${
        large
          ? "text-[clamp(1.25rem,0.95rem+1.3vw,2.125rem)] font-medium leading-[1.25]"
          : "px-4 py-8 leading-[1.5] sm:p-12"
      } ${className}`}
    >
      {name && <p className="statement">{name}</p>}
      {contact.length > 0 && <p className="small mt-2 break-words">{contact.join(" | ")}</p>}
      {result.sections.map((section) => (
        <section key={section.name} className={large ? "" : "mt-9"}>
          {/* A real heading on the result, so the resume can be moved through
              by its sections. In the demo it is only a picture of a resume,
              and a heading there would muddle the page's own outline. */}
          <SectionName
            className={large ? "sr-only" : "text-[1.25em] font-bold uppercase leading-none tracking-[-0.03em]"}
          >
            {section.name}
          </SectionName>
          {section.entries.map((entry, index) => {
            const hasHeading = Boolean(entry.title || entry.organization);
            return (
              <div key={index} className={large ? "" : "mt-4"}>
                {(hasHeading || entry.dates) && (
                  <div
                    className={`flex flex-wrap justify-between gap-x-4 ${large ? "text-[length:var(--step-body)] font-normal" : ""}`}
                  >
                    <p>
                      <span className="font-bold">{entry.title}</span>
                      {entry.title && entry.organization && ", "}
                      {entry.organization}
                    </p>
                    <p>{entry.dates}</p>
                  </div>
                )}
                {/* A section with no entry heading, like skills, is plain rows. */}
                <ul className={hasHeading ? `ml-[1.05em] list-[square] ${large ? "mt-3 space-y-4" : "space-y-1.5"}` : ""}>
                  {entry.lines.map((line) => {
                    const bullet = line.bullet_id ? bullets.get(line.bullet_id) : undefined;
                    if (!bullet || pending) {
                      return (
                        <li key={line.evidence_id} className="mt-1.5">
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
                        // demo leaves it out to stay short.
                        asked={
                          large
                            ? []
                            : result.requirements
                                .filter((req) => bullet.requirement_ids.includes(req.id))
                                .map((req) => req.text)
                        }
                        kept={kept.has(bullet.id)}
                        open={(hovered ?? openId) === bullet.id}
                        order={order.get(bullet.id) ?? 0}
                        // The result page's jump buttons scroll to this ID.
                        anchor={large ? undefined : lineAnchor(bullet.id)}
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
