// Icons with no words in them. Kept apart from parts.tsx so that a small
// browser-side piece can use them without also loading the site's copy.

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
