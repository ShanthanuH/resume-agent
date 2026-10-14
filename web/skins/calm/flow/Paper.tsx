"use client";

import { useRef, useState } from "react";
import type { Result } from "@/lib/types";
import { TraceLine } from "./TraceLine";

type Props = {
  result: Result;
  label: string; // the name screen readers announce for the resume
  kept: Set<string>; // bullet IDs where the visitor keeps their original
  openId: string | null; // the changed line opened by a tap
  onOpen: (bulletId: string | null) => void;
  onKeep: (bulletId: string, keep: boolean) => void;
};

const HOVER_IN_MS = 90; // so sweeping the mouse across does not open every line
const HOVER_OUT_MS = 220; // long enough to move from the line into its panel

/** The resume as a white sheet on a soft double-bezel card. */
export function Paper({ result, label, kept, openId, onOpen, onKeep }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bullets = new Map(result.bullets.map((bullet) => [bullet.id, bullet]));
  const [name, ...contact] = result.header;

  const order = new Map<string, number>();
  for (const section of result.sections)
    for (const entry of section.entries)
      for (const line of entry.lines) if (line.bullet_id) order.set(line.bullet_id, order.size);

  function hover(bulletId: string, inside: boolean) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(inside ? bulletId : null), inside ? HOVER_IN_MS : HOVER_OUT_MS);
  }

  return (
    <div className="rounded-shell bg-ink/[0.03] p-1.5 ring-1 ring-line">
      <article
        aria-label={label}
        className="rounded-card bg-paper px-5 py-8 text-[1rem] leading-[1.55] shadow-soft sm:px-12 sm:py-12"
      >
        {name && <p className="t-heading">{name}</p>}
        {contact.length > 0 && <p className="t-small mt-1.5 break-words text-ink-soft">{contact.join(" | ")}</p>}
        {result.sections.map((section) => (
          <section key={section.name} className="mt-9">
            <h2 className="border-b border-line pb-2 text-[1.0625rem] font-semibold tracking-[-0.01em]">{section.name}</h2>
            {section.entries.map((entry, index) => {
              const hasHeading = Boolean(entry.title || entry.organization);
              return (
                <div key={index} className="mt-4">
                  {(hasHeading || entry.dates) && (
                    <div className="flex flex-wrap justify-between gap-x-4">
                      <p>
                        <span className="font-semibold">{entry.title}</span>
                        {entry.title && entry.organization && ", "}
                        {entry.organization}
                      </p>
                      <p className="text-ink-soft">{entry.dates}</p>
                    </div>
                  )}
                  <ul className={hasHeading ? "ml-[1.1em] mt-1 list-disc marker:text-ink-soft" : ""}>
                    {entry.lines.map((line) => {
                      const bullet = line.bullet_id ? bullets.get(line.bullet_id) : undefined;
                      if (!bullet) {
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
                          asked={result.requirements.filter((req) => bullet.requirement_ids.includes(req.id)).map((req) => req.text)}
                          kept={kept.has(bullet.id)}
                          open={(hovered ?? openId) === bullet.id}
                          order={order.get(bullet.id) ?? 0}
                          onToggle={() => onOpen(openId === bullet.id ? null : bullet.id)}
                          onHover={(inside) => hover(bullet.id, inside)}
                          onKeep={(keep) => onKeep(bullet.id, keep)}
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
    </div>
  );
}
