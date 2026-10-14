// The shared pieces of the calm skin. Every calm screen builds from these and
// from the classes in calm.css (.glass, .ink, .field, .lift, .struck, .cloud).

import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { copy } from "@/lib/copy";

/** The site name in Instrument Serif. White on the dark photo areas. */
export function Wordmark({ className = "", light = false }: { className?: string; light?: boolean }) {
  return <span className={`font-serif ${light ? "text-white" : "text-ink-900"} ${className}`}>{copy.nav_brand}</span>;
}

type GlassProps = ComponentProps<"div"> & {
  /** "photo" on the running and result screens: a little more blur and white. */
  tone?: "day" | "photo";
};

/** A frosted glass card. Give it a radius and padding through className. */
export function Glass({ tone = "day", className = "", children, ...rest }: GlassProps) {
  return (
    <div className={`glass ${tone === "photo" ? "glass-photo" : ""} ${className}`} {...rest}>
      {children}
    </div>
  );
}

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The id of the visible label next to the switch. */
  labelledBy: string;
  /** "large" is the 54 x 32 switch of the wide result panel. */
  size?: "normal" | "large";
};

/**
 * An on/off switch: a <button role="switch">. The visible label sits next to
 * it, with the id given in labelledBy. The tap area is 44 px or more.
 */
export function Switch({ checked, onChange, labelledBy, size = "normal" }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      data-size={size}
      onClick={() => onChange(!checked)}
      className={`switch ${checked ? "ink" : ""}`}
    >
      <span aria-hidden className="switch-knob" />
    </button>
  );
}

// Each strike leans its own way, in this order, then the order repeats.
const ANGLES = ["-3deg", "2deg", "-1.5deg", "4deg", "-2.5deg"];

type StruckProps = {
  word: string;
  /** Its place in the list: picks the angle of its line. */
  index: number;
  /** Draw the line as the section scrolls into view (landing page only). */
  draw?: boolean;
  className?: string;
};

/**
 * A skill the job asks for and the resume lacks, with a hand-drawn line
 * through it. Screen readers hear "Kubernetes, not on your resume".
 */
export function Struck({ word, index, draw = false, className = "" }: StruckProps) {
  const style = { "--r": ANGLES[index % ANGLES.length] } as CSSProperties;
  return (
    <span className={`struck ${className}`}>
      {word}
      <span className="sr-only">{copy.calm_missing_sr}</span>
      <span aria-hidden className={`strike ${draw ? "strike-draw" : ""}`} style={style} />
    </span>
  );
}

/** The green box with the line as it was. Its first word is "Before:". */
export function Before({ text, className = "", id }: { text: string; className?: string; id?: string }) {
  return (
    <div id={id} className={`before ${className}`}>
      <b>{copy.calm_before}</b> {text}
    </div>
  );
}

/** Changed text: the yellow mark. */
export function Mark({ children }: { children: ReactNode }) {
  return <mark className="mark">{children}</mark>;
}

/** A soft cloud shape. Place it with className or style; it is decorative. */
export function Cloud({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={`cloud ${className}`} style={style} />;
}

/** The FAQ chevron. Turn it with "rotate-180" when open. */
export function Chevron({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`transition-transform duration-[250ms] ease-[ease] motion-reduce:transition-none ${className}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** The file-with-an-arrow icon of the drop area. */
export function FileIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 11v6" />
      <path d="M9.5 13.5 12 11l2.5 2.5" />
    </svg>
  );
}

/** The paper plane at the end of the progress bar. */
export function PlaneIcon({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#0B2340" strokeWidth="1.4" strokeLinejoin="round" aria-hidden className={className} style={style}>
      <path d="M2 11.5 21 4l-5.5 16-3.4-6.6z" />
      <path d="M12.1 13.4 21 4" />
    </svg>
  );
}

/** The check inside a finished step's ink circle. */
export function CheckIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

/** The arrow-into-a-tray icon of the download button. */
export function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

/**
 * Ask the browser for the sky photo early: the tall one on phones, the wide
 * one above 860 px. React puts these <link> tags in the page's <head>.
 */
export function HeroPreload() {
  return (
    <>
      <link rel="preload" as="image" href="/hero/hero-tall.webp" media="(max-width: 860px)" />
      <link rel="preload" as="image" href="/hero/hero-wide.webp" media="(min-width: 861px)" />
    </>
  );
}
