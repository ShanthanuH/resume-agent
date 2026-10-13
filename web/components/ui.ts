// The few looks that repeat across the site, as class lists. Keeping them here
// means every button has the same shape, size and motion.

/** The main action: solid ink. Tall enough to tap comfortably (48 px). */
export const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-ink px-6 text-base font-medium text-paper " +
  "transition-[background-color,transform,opacity] duration-150 ease-swoosh hover:bg-pine active:scale-[0.985] " +
  "disabled:opacity-60";

/** The main action on a dark panel: the highlighter yellow, so it stands out on ink. */
export const accentButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-mark px-6 text-base font-medium text-ink " +
  "transition-[background-color,transform] duration-150 ease-swoosh hover:bg-mark-deep active:scale-[0.985]";

/** A smaller main action, for the page header. */
export const smallButton =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] bg-ink px-4 text-sm font-medium text-paper " +
  "transition-[background-color,transform] duration-150 ease-swoosh hover:bg-pine active:scale-[0.985]";

/** A second choice next to a main action: an outline. */
export const outlineButton =
  "inline-flex min-h-12 items-center justify-center rounded-[10px] border border-ink px-6 text-base font-medium " +
  "transition-[background-color,color,transform] duration-150 ease-swoosh hover:bg-ink hover:text-paper active:scale-[0.985]";

/** A link inside text, or a small text button. min-h-11 keeps it tappable. */
export const quietLink =
  "inline-flex min-h-11 items-center underline decoration-rule decoration-1 underline-offset-4 " +
  "transition-[text-decoration-color] duration-150 ease-swoosh hover:decoration-ink";

/** The width and side padding every page shares. */
export const page = "mx-auto w-full max-w-6xl px-5 sm:px-8";
