// The looks that repeat across the calm skin, as class lists. Keeping them
// here means every button has the same shape, size and motion. The rules
// behind them are in DESIGN.md at the top of the repo.

const pill =
  "group inline-flex min-h-12 items-center justify-center gap-3 rounded-full text-[1rem] font-medium " +
  "transition-transform duration-[160ms] ease-calm active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100";

/**
 * The main action: an ink pill with white text. Put <ArrowDot /> inside,
 * after the words, for the trailing arrow in its own circle.
 */
export const primaryButton = `${pill} bg-ink pl-6 pr-1.5 text-white shadow-soft`;

/** The main action with no arrow (e.g. a busy state): even padding. */
export const primaryButtonPlain = `${pill} bg-ink px-6 text-white shadow-soft`;

/** The second choice next to a main button: a white pill with a hairline ring. */
export const secondaryButton = `${pill} bg-paper px-6 text-ink ring-1 ring-line hover:bg-mist`;

/** A link inside text, or a small text button. min-h-11 keeps it tappable. */
export const textLink =
  "inline-flex min-h-11 items-center text-sky-ink underline decoration-1 underline-offset-4 " +
  "transition-[text-underline-offset] duration-[160ms] ease-calm hover:underline-offset-[6px]";

/** The same link, for use inside a sentence (no extra height). */
export const inlineLink =
  "text-sky-ink underline decoration-1 underline-offset-4 transition-[text-underline-offset] duration-[160ms] ease-calm hover:underline-offset-[6px]";

/** The page's width and side padding. Every section's content sits in it. */
export const page = "mx-auto w-full max-w-[72rem] px-5 sm:px-8";

/** Top and bottom room of a section. */
export const section = "py-[var(--section)]";

/** The room a page needs at its top, under the floating header. */
export const pageTop = "pt-28 sm:pt-32";

/** A text box or text area. */
export const field =
  "block w-full rounded-field bg-paper px-4 py-3.5 text-ink ring-1 ring-line placeholder:text-ink-soft/70 " +
  "transition-shadow duration-[160ms] ease-calm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-ink " +
  "aria-invalid:ring-2 aria-invalid:ring-problem";

/** The sentence under a field that has a problem. */
export const problemText = "t-small mt-2 font-medium text-problem";
