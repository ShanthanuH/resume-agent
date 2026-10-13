// Plays a saved run back through the same handlers a live run calls.
//
// Each saved step has `at`: when it reached the browser in the real run, in
// milliseconds from the start. The player waits that long (divided by `speed`)
// and then hands the step over, so the screen moves exactly as it did live:
// steps arrive in the same bursts, with the same quiet gaps between them.

import type { ErrorCode, Result, SavedRun, Step } from "./types";

/** What a run reports as it goes. A live run and a replay both call these. */
export type RunHandlers = {
  onQueued: () => void;
  onStep: (step: Step) => void;
  onDone: (result: Result) => void;
  onFailed: (code: ErrorCode) => void;
};

export type ReplayOptions = {
  /** 1 plays at the run's real speed. 16 plays it sixteen times faster. */
  speed?: number;
  /** Stops the replay, for example when the visitor leaves the page. */
  signal: AbortSignal;
};

/** When each step arrives. Falls back to adding up latencies if `at` is missing. */
export function arrivals(steps: Step[]): number[] {
  let clock = 0;
  return steps.map((step) => {
    clock += step.ms;
    return step.at ?? clock;
  });
}

/**
 * Start playing. Returns `skip`, which hands over everything that is left at
 * once and finishes: the "Skip to the result" button.
 */
export function playReplay(run: SavedRun, handlers: RunHandlers, options: ReplayOptions): { skip: () => void } {
  const speed = options.speed ?? 1;
  const times = arrivals(run.steps);
  const timers: ReturnType<typeof setTimeout>[] = [];
  let next = 0; // index of the first step not handed over yet
  let ended = false;

  const stop = () => {
    ended = true;
    timers.forEach(clearTimeout);
  };
  options.signal.addEventListener("abort", stop);

  /** Hand over every step up to and including index `last`. */
  const release = (last: number) => {
    while (next <= last) handlers.onStep(run.steps[next++]);
  };
  const finish = () => {
    if (ended) return;
    release(run.steps.length - 1);
    stop();
    handlers.onDone(run.result);
  };

  times.forEach((at, index) => {
    // Steps with the same time are handed over in the same instant, as one burst.
    timers.push(
      setTimeout(() => {
        if (!ended) release(index);
      }, at / speed),
    );
  });
  // The run's own length is the truth for when it ended. It can be a little
  // past the last step, which is the time the server took to build the result.
  const total = Math.max(run.result.stats.seconds * 1000, times[times.length - 1] ?? 0);
  timers.push(setTimeout(finish, total / speed));

  return { skip: finish };
}
