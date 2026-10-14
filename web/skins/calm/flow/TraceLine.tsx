"use client";

import { useId, useMemo } from "react";
import { copy, fill } from "@/lib/copy";
import { diffWords } from "@/lib/diff";
import { lineAnchor } from "@/lib/result-text";
import type { Bullet } from "@/lib/types";
import { Mark, Original } from "../primitives";
import { textLink } from "../ui";

type Props = {
  bullet: Bullet;
  original: string; // the line as the visitor wrote it
  asked: string[]; // what the job asks for that this line shows
  kept: boolean; // the visitor chose their original over the rewrite
  open: boolean; // the other version is showing under the line
  order: number; // place among the changed lines, to stagger the highlight
  onToggle: () => void;
  onHover: (inside: boolean) => void;
  onKeep: (keep: boolean) => void;
};

/**
 * One changed line of the resume, the signature of the product. Changed words
 * are yellow. Tap the line (or hover, or press Enter) and the visitor's own
 * line opens under it in green. Yellow is "this changed", green is "you wrote
 * this". When the original is kept, the line shows it, and the rewrite sits
 * in a neutral mist panel (never green: green is only the visitor's words).
 */
export function TraceLine({ bullet, original, asked, kept, open, order, onToggle, onHover, onKeep }: Props) {
  const panel = useId();
  const pieces = useMemo(() => diffWords(original, bullet.text), [original, bullet.text]);

  const askedLine = asked.length > 0 && (
    <p className="t-small mt-2 text-ink-soft">{fill(copy.trace_asked, { things: asked.join(" · ") })}</p>
  );
  const toggle = (
    <button type="button" onClick={() => onKeep(!kept)} className={`${textLink} t-small font-medium`}>
      {kept ? copy.trace_use_rewrite : copy.trace_keep_original}
    </button>
  );

  return (
    <li
      id={lineAnchor(bullet.id)}
      // Only a mouse hovers; a tap would open the line and toggle it again.
      onPointerEnter={(event) => event.pointerType === "mouse" && onHover(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && onHover(false)}
      className="mt-1 scroll-mt-28"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className="-mx-2 block min-h-11 w-[calc(100%+1rem)] rounded-field px-2 py-1.5 text-left transition-colors duration-[160ms] ease-calm hover:bg-sky-wash/60 aria-expanded:bg-sky-wash/60"
      >
        {kept
          ? original
          : pieces.map((piece, index) => (
              <span key={index}>
                {index > 0 && " "}
                {piece.changed ? (
                  <Mark sweep className="[animation-delay:calc(var(--i)*90ms)]">
                    {piece.text}
                  </Mark>
                ) : (
                  piece.text
                )}
              </span>
            ))}
      </button>
      <div id={panel} className="unfold" data-open={open} inert={!open} style={{ "--i": order } as React.CSSProperties}>
        <div>
          <div className="pb-3 pt-1.5">
            {kept ? (
              <div className="rounded-field bg-mist px-4 py-3 ring-1 ring-line">
                <p className="t-small font-medium">{copy.trace_kept}</p>
                <p className="mt-1">{bullet.text}</p>
                {askedLine}
                {toggle}
              </div>
            ) : (
              <Original>
                <p>{original}</p>
                {askedLine}
                {toggle}
              </Original>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
