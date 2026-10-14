"use client";

import { copy } from "@/lib/copy";
import { clock } from "@/lib/format";
import { useElapsed } from "@/components/flow/useElapsed";

type Props = {
  /** When the run began (a Date.now() value), or null if it has not begun. */
  startedAt: number | null;
  /** How fast a recorded run is playing. The clock runs that much faster too. */
  speed?: number;
  /** Show this many seconds and stand still: the length of a finished run. */
  fixed?: number;
  className?: string;
};

/**
 * The time a run has taken so far, as "0:42".
 *
 * It is its own small component on purpose. It changes every second (many
 * times a second in the sped-up demo), and React re-draws the component whose
 * state changed. Keeping the ticking state in here means a tick re-draws these
 * few characters and nothing else on the screen.
 */
export function Clock({ startedAt, speed = 1, fixed, className = "" }: Props) {
  // A fixed clock does not tick: passing null stops the timer.
  const elapsed = useElapsed(fixed === undefined ? startedAt : null, speed);
  return (
    // role="timer" names it as a clock. Screen readers do not read out every
    // tick of a timer, which is what we want.
    <span role="timer" aria-label={copy.run_elapsed_label} className={`tabular ${className}`}>
      {clock(fixed ?? elapsed)}
    </span>
  );
}
