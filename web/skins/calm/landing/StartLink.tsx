"use client";

import type { ReactNode } from "react";
import { IDS } from "../flow/contracts";
import { goToForm } from "./go";

/** A link to the form that also puts the cursor in the drop area. */
export function StartLink({ children, className }: { children: ReactNode; className: string }) {
  return (
    <a
      href={`#${IDS.start}`}
      onClick={(event) => {
        event.preventDefault();
        goToForm();
      }}
      className={className}
    >
      {children}
    </a>
  );
}
