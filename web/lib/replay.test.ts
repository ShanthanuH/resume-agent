import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EXAMPLE_RUN } from "./example";
import { arrivals, playReplay, type RunHandlers } from "./replay";
import type { ErrorCode, Result, Step } from "./types";

// Fake timers let a 64-second replay run in a millisecond of real time.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Handlers that write down what they were told. */
function recorder() {
  const steps: Step[] = [];
  const done: Result[] = [];
  const failed: ErrorCode[] = [];
  const handlers: RunHandlers = {
    onQueued: () => {},
    onStep: (step) => steps.push(step),
    onDone: (result) => done.push(result),
    onFailed: (code) => failed.push(code),
  };
  return { handlers, steps, done, failed };
}

const SECONDS = EXAMPLE_RUN.result.stats.seconds; // 63.5: how long the real run took

test("the recorded run is played at its real speed", () => {
  const log = recorder();
  playReplay(EXAMPLE_RUN, log.handlers, { signal: new AbortController().signal });

  vi.advanceTimersByTime(5000);
  expect(log.steps).toHaveLength(0); // the real run was still reading at 5 s
  vi.advanceTimersByTime(200);
  expect(log.steps.map((step) => step.kind)).toEqual(["read_resume", "read_job"]); // both land at 5.15 s

  vi.advanceTimersByTime(SECONDS * 1000 - 5200 - 100);
  expect(log.done).toHaveLength(0); // a moment before the end
  vi.advanceTimersByTime(200);
  expect(log.steps).toEqual(EXAMPLE_RUN.steps); // every step, in order, none twice
  expect(log.done).toEqual([EXAMPLE_RUN.result]);
});

test("steps that arrived together in the real run arrive together here", () => {
  const log = recorder();
  playReplay(EXAMPLE_RUN, log.handlers, { signal: new AbortController().signal });
  vi.advanceTimersByTime(17_431);
  expect(log.steps).toHaveLength(3); // both reads and the first plan
  vi.advanceTimersByTime(1); // 17.432 s: all the matching results at once
  expect(log.steps).toHaveLength(17);
});

test("speed 16 plays the same run sixteen times faster", () => {
  const log = recorder();
  playReplay(EXAMPLE_RUN, log.handlers, { speed: 16, signal: new AbortController().signal });
  vi.advanceTimersByTime((SECONDS * 1000) / 16 - 50);
  expect(log.done).toHaveLength(0);
  vi.advanceTimersByTime(100);
  expect(log.done).toHaveLength(1);
});

test("skip hands over everything that is left, once", () => {
  const log = recorder();
  const { skip } = playReplay(EXAMPLE_RUN, log.handlers, { signal: new AbortController().signal });
  vi.advanceTimersByTime(6000); // two steps in
  skip();
  expect(log.steps).toEqual(EXAMPLE_RUN.steps);
  expect(log.done).toHaveLength(1);
  skip(); // a second press does nothing
  vi.advanceTimersByTime(120_000); // and the cancelled timers stay quiet
  expect(log.steps).toHaveLength(EXAMPLE_RUN.steps.length);
  expect(log.done).toHaveLength(1);
});

test("aborting stops it for good", () => {
  const log = recorder();
  const controller = new AbortController();
  playReplay(EXAMPLE_RUN, log.handlers, { signal: controller.signal });
  vi.advanceTimersByTime(6000);
  controller.abort(); // the visitor left the page
  vi.advanceTimersByTime(120_000);
  expect(log.steps).toHaveLength(2);
  expect(log.done).toHaveLength(0);
});

test("a replay never reports a failure", () => {
  const log = recorder();
  playReplay(EXAMPLE_RUN, log.handlers, { signal: new AbortController().signal });
  vi.advanceTimersByTime(120_000);
  expect(log.failed).toEqual([]);
});

test("a recording without arrival times falls back to adding up how long each step took", () => {
  const steps: Step[] = [
    { n: 1, kind: "read_resume", ms: 300 },
    { n: 2, kind: "read_job", ms: 200 },
  ];
  expect(arrivals(steps)).toEqual([300, 500]);
});
