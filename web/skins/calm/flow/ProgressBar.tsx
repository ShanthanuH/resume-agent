import { copy } from "@/lib/copy";
import { PHASES, type Phase } from "@/lib/run-machine";

type Props = {
  phase: Phase;
  finished?: boolean; // true fills every part
  sentence: string; // what the run is doing, read out to screen-reader users
};

/**
 * The one progress element: a slim track in five parts, one per stage. It
 * shows which stage the run is in, not a percentage, because nobody knows how
 * long a stage takes. Done stages are sky, the current one breathes, the rest
 * are faint.
 */
export function ProgressBar({ phase, finished = false, sentence }: Props) {
  // "fixing" is a second pass at rewriting, so it lights the same part.
  const current = finished ? PHASES.length : PHASES.indexOf(phase === "fixing" ? "rewriting" : phase);
  return (
    <div
      role="progressbar"
      aria-label={copy.run_progress_label}
      aria-valuemin={0}
      aria-valuemax={PHASES.length}
      aria-valuenow={current}
      aria-valuetext={sentence}
      className="flex w-full gap-1.5"
    >
      {PHASES.map((name, index) => (
        <span
          key={name}
          className={`h-1.5 flex-1 rounded-full ${
            index < current ? "bg-sky" : index === current ? "breathe bg-sky" : "bg-ink/10"
          }`}
        />
      ))}
    </div>
  );
}
