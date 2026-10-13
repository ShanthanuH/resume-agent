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
  anchor?: string; // the line's page ID, where something needs to scroll to it
  onToggle: () => void;
  onHover: (inside: boolean) => void;
  onKeep?: (keep: boolean) => void; // left out where the choice is not offered
};

/** The page ID of a changed line, so a button elsewhere can scroll to it. */
export const lineAnchor = (bulletId: string) => `line-${bulletId}`;

/**
 * One changed line of the resume, and the signature of the whole product.
 *
 * The changed words are lemon. Point at the line (or tap it, or press Enter on
 * it) and the original line from the visitor's own resume opens underneath on
 * mint. Lemon is "this changed", mint is "this is what you wrote": the two
 * colours mean that everywhere on the site.
 */
export function TraceLine({ bullet, original, asked, kept, open, order, anchor, onToggle, onHover, onKeep }: Props) {
  const panel = useId(); // links the button to the panel it opens, for screen readers
  // The diff only changes when the texts do, so it is worked out once.
  const pieces = useMemo(() => diffWords(original, bullet.text), [original, bullet.text]);

  return (
    <li
      id={anchor}
      // pointerType tells a mouse from a finger. Only a mouse can "hover"; a
      // tap would otherwise open the line here and toggle it again on click.
      onPointerEnter={(event) => event.pointerType === "mouse" && onHover(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && onHover(false)}
      className="swoosh mt-1.5"
      // --i is read by the .swoosh rule in globals.css to delay each highlight a little.
      style={{ "--i": order } as React.CSSProperties}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className="group block w-full cursor-pointer text-left"
      >
        {kept ? (
          // The visitor's own line again, on its own colour.
          <span className="bg-yours box-decoration-clone px-[0.14em] py-[0.04em] -mx-[0.14em]">{original}</span>
        ) : (
          pieces.map((piece, index) => (
            // A space between pieces: diffWords returns them without.
            <span key={index}>
              {index > 0 && " "}
              {piece.changed ? (
                // A black bar under the highlight says "this one is open" (or
                // about to be: it also shows while the mouse is over the line).
                <mark className="border-b-[3px] border-transparent group-hover:border-black group-aria-expanded:border-black">
                  {piece.text}
                </mark>
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
          <div className={`mb-3 mt-2 px-4 py-3 ${kept ? "field-changed" : "field-yours"}`}>
            <p className="small font-bold">{kept ? copy.trace_kept : copy.trace_original}</p>
            <p className="mt-1">{kept ? bullet.text : original}</p>
            {asked.length > 0 && (
              <p className="small mt-2 font-normal">{fill(copy.trace_asked, { things: asked.join(" · ") })}</p>
            )}
            {onKeep && (
              <button type="button" onClick={() => onKeep(!kept)} className={`${quietLink} small font-bold`}>
                {kept ? copy.trace_use_rewrite : copy.trace_keep_original}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
