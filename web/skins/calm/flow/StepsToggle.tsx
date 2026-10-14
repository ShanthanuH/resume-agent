"use client";

import { useId, useState } from "react";
import { copy } from "@/lib/copy";
import type { Step } from "@/lib/types";
import { textLink } from "../ui";
import { StepList } from "./StepList";

/** The small "Show steps" toggle and the list it opens. Closed to begin with. */
export function StepsToggle({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(false);
  const list = useId(); // ties the button to the list, for screen readers
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? list : undefined}
        onClick={() => setOpen(!open)}
        className={`${textLink} t-small`}
      >
        {open ? copy.run_hide_steps : copy.run_show_steps}
      </button>
      {open && (
        <div className="rise mt-1">
          <StepList steps={steps} id={list} />
        </div>
      )}
    </div>
  );
}
