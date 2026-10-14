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
 * The time a run has taken so far, as "0:42". Its own small component so a
 * tick re-draws these few characters and nothing else.
 */
export function Clock({ startedAt, speed = 1, fixed, className = "" }: Props) {
  const elapsed = useElapsed(fixed === undefined ? startedAt : null, speed);
  return (
    // role="timer": screen readers do not read out every tick.
    <span role="timer" aria-label={copy.run_elapsed_label} className={`tabular-nums ${className}`}>
      {clock(fixed ?? elapsed)}
    </span>
  );
}
