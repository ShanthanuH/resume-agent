import { copy } from "@/lib/copy";
import { PHASES, type Phase } from "@/lib/run-machine";

type Props = {
  phase: Phase;
  finished?: boolean; // true fills every part
  sentence: string; // what the run is doing, read out to screen-reader users
};

/**
 * The one progress element: five short bars, one per stage of a run.
 *
 * It shows which stage the run is in, not a percentage. Nobody knows how long
 * a stage will take, so a percentage would be made up. Finished stages are
 * solid, the current one has a light moving through it, the rest are faint.
 */
export function ProgressBar({ phase, finished = false, sentence }: Props) {
  // "fixing" is a second pass at rewriting, so it lights the same bar.
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
          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ease-swoosh ${
            index < current ? "bg-ink" : index === current ? "sweep bg-rule" : "bg-rule"
          }`}
        />
      ))}
    </div>
  );
}
