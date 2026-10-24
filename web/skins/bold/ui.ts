// The few looks that repeat across the site, as class lists. Keeping them here
// means every button has the same shape, size and motion. The rules behind
// them are in DESIGN.md.

// What every button shares: a flat rectangle, 52 px tall, that moves down 2 px
// when pressed.
const button =
  "inline-flex min-h-13 items-center justify-center gap-2 px-7 text-[length:var(--step-body)] font-medium " +
  "transition-transform duration-[120ms] ease-swoosh hover:-translate-y-0.5 active:translate-y-0.5 " +
  "disabled:opacity-60";

/** The main action on the black ground: cyan with black text. */
export const primaryButton = `${button} bg-action text-black`;

/** The main action on a colour field or on the sheet: black with white text. */
export const inkButton = `${button} bg-black text-white`;

/** A smaller main action, for the page header. */
export const smallButton =
  "inline-flex min-h-11 items-center justify-center bg-action px-4 text-[length:var(--step-small)] font-medium text-black " +
  "transition-transform duration-[120ms] ease-swoosh hover:-translate-y-0.5 active:translate-y-0.5";

/**
 * A link inside text, a small text button, or the second choice next to a
 * main button. Underlined in the text's own colour, so it works on any field.
 * min-h-11 keeps it tappable.
 */
export const quietLink =
  "inline-flex min-h-11 items-center underline decoration-2 underline-offset-4 " +
  "transition-[text-underline-offset] duration-[120ms] ease-swoosh hover:underline-offset-[7px]";

/** The width and side margins every chapter shares: its text starts on this edge. */
export const page = "mx-auto w-full max-w-[85rem] px-4 sm:px-10";

// A chapter split into two fields side by side. Each half is a full-bleed
// colour, but its content keeps the page's outer margin: on a window wider
// than the page, the outer padding grows by half of the extra width.
// (The class is written out in full twice: Tailwind finds classes by reading
// this file as text, so it cannot follow a class built from pieces.)
/** The left half of a split chapter. */
export const halfLeft = "px-4 sm:px-10 lg:pl-[max(2.5rem,calc((100vw-85rem)/2+2.5rem))]";
/** The right half of a split chapter. */
export const halfRight = "px-4 sm:px-10 lg:pr-[max(2.5rem,calc((100vw-85rem)/2+2.5rem))]";

/**
 * A plus sign drawn from two 3 px bars, for a toggle row. Inside an open
 * <details class="group"> the upright bar turns flat, which leaves a minus.
 */
export const plus =
  "relative h-4 w-4 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:-mt-[1.5px] before:h-[3px] before:bg-current " +
  "after:absolute after:inset-y-0 after:left-1/2 after:-ml-[1.5px] after:w-[3px] after:bg-current " +
  "after:transition-transform after:duration-200 after:ease-swoosh group-open:after:rotate-90";

/** A chapter's top and bottom padding. */
export const chapter = "py-[var(--chapter)]";
