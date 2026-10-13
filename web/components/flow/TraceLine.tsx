"use client";

import { useId, useMemo } from "react";
import { copy, fill } from "@/lib/copy";
import { diffWords } from "@/lib/diff";
import type { Bullet } from "@/lib/types";
import { quietLink } from "../ui";

type Props = {
  bullet: Bullet;
  original: string; // the line as the visitor wrote it
  asked: string[]; // what the job asks for that this line shows
  kept: boolean; // true: the visitor chose their original over the rewrite
  open: boolean; // true: the other version is showing under the line
  order: number; // 0, 1, 2... among the changed lines, to stagger the highlight
  onToggle: () => void;
  onHover: (inside: boolean) => void;
  onKeep?: (keep: boolean) => void; // left out where the choice is not offered
};

/**
 * One changed line of the resume, and the signature of the whole product.
 *
 * The changed words are highlighted. Point at the line (or tap it, or press
 * Enter on it) and the original line from the visitor's own resume slides in
 * underneath. That one gesture is the promise: every change comes from a line
 * you wrote.
 */
export function TraceLine({ bullet, original, asked, kept, open, order, onToggle, onHover, onKeep }: Props) {
  const panel = useId(); // links the button to the panel it opens, for screen readers
  // The diff only changes when the texts do, so it is worked out once.
  const pieces = useMemo(() => diffWords(original, bullet.text), [original, bullet.text]);

  return (
    <li
      // pointerType tells a mouse from a finger. Only a mouse can "hover"; a
      // tap would otherwise open the line here and toggle it again on click.
      onPointerEnter={(event) => event.pointerType === "mouse" && onHover(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && onHover(false)}
      className="swoosh mt-1"
      // --i is read by the .swoosh rule in globals.css to delay each highlight a little.
      style={{ "--i": order } as React.CSSProperties}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className="group block w-full cursor-pointer rounded-sm text-left"
      >
        {kept ? (
          // The visitor's own line again. The dotted line says "there is more here".
          <span className="underline decoration-muted decoration-dotted underline-offset-4">{original}</span>
        ) : (
          pieces.map((piece, index) => (
            // A space between pieces: diffWords returns them without.
            <span key={index}>
              {index > 0 && " "}
              {piece.changed ? (
                <mark className="group-hover:bg-mark-deep group-aria-expanded:bg-mark-deep">{piece.text}</mark>
              ) : (
                piece.text
              )}
            </span>
          ))
        )}
      </button>

      {/* inert takes the closed panel out of the tab order and away from screen readers. */}
      <div id={panel} className="reveal" data-open={open} inert={!open}>
        <div>
          <div className="mb-2 mt-1.5 border-l-2 border-ink pl-3">
            <p className="label">{kept ? copy.trace_kept : copy.trace_original}</p>
            <p className="mt-0.5 text-soft">{kept ? bullet.text : original}</p>
            {asked.length > 0 && (
              <p className="mt-1 text-[0.85em] text-muted">
                {fill(copy.trace_asked, { things: asked.join(" · ") })}
              </p>
            )}
            {onKeep && (
              <button type="button" onClick={() => onKeep(!kept)} className={`${quietLink} text-[0.9em] font-medium`}>
                {kept ? copy.trace_use_rewrite : copy.trace_keep_original}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
