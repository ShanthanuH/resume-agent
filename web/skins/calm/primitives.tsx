// The shared pieces of the calm skin. Every calm screen builds from these and
// from the class lists in ui.ts; DESIGN.md says what each one is for.

import type { ComponentProps, ReactNode } from "react";
import { copy } from "@/lib/copy";

/** The arrow in its own circle, at the end of a primary button. */
export function ArrowDot() {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 transition-transform duration-[160ms] ease-calm group-hover:translate-x-0.5"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    </span>
  );
}

type CardProps = ComponentProps<"div"> & {
  /** "soft" on white pages; "float" over the photo (frosted, deeper shadow). */
  tone?: "soft" | "float";
  /** Extra classes for the inner core (padding, layout). */
  coreClassName?: string;
};

/**
 * The double-bezel card: a faint outer shell holding a white core, with
 * concentric corners. Put content in it; give padding through coreClassName.
 */
export function Card({ tone = "soft", className = "", coreClassName = "p-6 sm:p-8", children, ...rest }: CardProps) {
  const shell =
    tone === "float"
      ? "rounded-shell bg-white/35 p-1.5 ring-1 ring-white/50 shadow-float backdrop-blur-xl"
      : "rounded-shell bg-ink/[0.03] p-1.5 ring-1 ring-line";
  const core = tone === "float" ? "bg-white/90" : "bg-paper shadow-soft";
  return (
    <div className={`${shell} ${className}`} {...rest}>
      <div className={`rounded-card ${core} ${coreClassName}`}>{children}</div>
    </div>
  );
}

/** A small sentence-case label in a pill, above a title. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`t-eyebrow inline-flex items-center gap-2 rounded-full bg-sky-wash px-3 py-1.5 text-sky-ink ${className}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sky" />
      {children}
    </span>
  );
}

/**
 * A word or run of words the run changed. Yellow, and nothing else on the
 * site is yellow. `sweep` makes the yellow slide in once as it appears.
 */
export function Mark({ children, sweep = false, className = "" }: { children: ReactNode; sweep?: boolean; className?: string }) {
  return <mark className={`mark ${sweep ? "sweep bg-transparent" : ""} ${className}`}>{children}</mark>;
}

/**
 * Your original line, as you wrote it: a green panel with a green left edge
 * and its label. Green means this, and nothing else on the site is green.
 * `label` replaces the default "Your original line" (e.g. for "You kept your
 * original"); `children` is the line, then anything under it.
 */
export function Original({ children, label = copy.trace_original, className = "" }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div className={`rounded-field border-l-[3px] border-yours-edge bg-yours px-4 py-3 text-ink ${className}`}>
      <p className="t-small font-medium">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** A skill the job asks for that the resume does not show: crossed out. */
export function Strike({ children }: { children: ReactNode }) {
  return <s className="strike">{children}</s>;
}
