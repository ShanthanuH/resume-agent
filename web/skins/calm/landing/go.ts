// The two moves the landing page's buttons make. Used by the hero's nav and
// by the closing button.

import { IDS } from "../flow/contracts";

/** Scroll to an element, smoothly unless the visitor asked for less motion. */
export function scrollTo(id: string, block: ScrollLogicalPosition) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block });
}

/** Scroll to the form and put the cursor in the drop area, if it is on screen. */
export function goToForm() {
  scrollTo(IDS.start, "center");
  document.getElementById(IDS.drop)?.focus({ preventScroll: true });
}
