"use client";

import { useId, useState, type ReactNode } from "react";
import { Chevron } from "../icons";

type Props = {
  /** What the button shows. Drawn on the server and passed in. */
  label: ReactNode;
  /** What opens under it. Also drawn on the server. */
  panel: ReactNode;
  startOpen?: boolean;
  /** Put the button in an h3 (the questions are headings). */
  heading?: boolean;
  /** Add the chevron that turns when open (the questions). */
  chevron?: boolean;
  buttonClassName?: string;
};

/**
 * A button that shows and hides the part under it: the example's "Before"
 * boxes and the answers to the questions. The words come in as props, so this
 * small piece is the only code the browser needs for them.
 */
export function Disclosure({ label, panel, startOpen = false, heading = false, chevron = false, buttonClassName = "" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(startOpen);
  const button = (
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className={buttonClassName}>
      {label}
      {chevron && <Chevron size={20} className={open ? "rotate-180" : ""} />}
    </button>
  );
  return (
    <>
      {heading ? <h3 className="m-0">{button}</h3> : button}
      <div id={id} hidden={!open}>
        {panel}
      </div>
    </>
  );
}
