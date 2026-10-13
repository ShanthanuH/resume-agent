import { copy } from "@/lib/copy";
import { PHASES, type Phase } from "@/lib/run-machine";

type Props = {
  phase: Phase;
  finished?: boolean; // true fills every part
  sentence: string; // what the run is doing, read out to screen-reader users
};

/**
 * The one progress element: five solid blocks, one per stage of a run.
 *
 * It shows which stage the run is in, not a percentage. Nobody knows how long
 * a stage will take, so a percentage would be made up. Finished stages are
 * solid, the current one has a block moving through it, the rest are faint.
 * The blocks take the text colour of the field they sit on.
 */
export function ProgressBar({ phase, finished = false, sentence }: Props) {
  // "fixing" is a second pass at rewriting, so it lights the same block.
  const current = finished ? PHASES.length : PHASES.indexOf(phase === "fixing" ? "rewriting" : phase);
  return (
    <div
      role="progressbar"
      aria-label={copy.run_progress_label}
      aria-valuemin={0}
      aria-valuemax={PHASES.length}
      aria-valuenow={current}
      aria-valuetext={sentence}
      className="flex w-full gap-1"
    >
      {PHASES.map((name, index) => (
        <span
          key={name}
          className={`h-3 flex-1 ${index < current ? "bg-current" : index === current ? "sweep bg-current/25" : "bg-current/25"}`}
        />
      ))}
    </div>
  );
}
