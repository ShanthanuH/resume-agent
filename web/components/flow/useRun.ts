"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { fetchAvailability, hasOwnerKey, startRun } from "@/lib/api";
import { EXAMPLE_RUN } from "@/lib/example";
import { setLiveRunGoing } from "@/lib/leave-guard";
import { playReplay, type RunHandlers } from "@/lib/replay";
import { INITIAL, reduce, type Input, type RunState } from "@/lib/run-machine";

type Options = {
  /** The state to begin in. The states page uses it to open on any screen. */
  initial?: RunState;
  /** Ask the server, once, whether live runs are open. Off where none can start. */
  checkAvailability: boolean;
};

type ReplayStart = {
  speed?: number; // see playReplay
};

/**
 * The state machine plus everything it must not do itself: start a live run,
 * play the recording, warn before the tab closes, ask if runs are open.
 *
 * The machine (lib/run-machine.ts) is pure. This hook is the only place where
 * the flow touches the network or a timer, and every result of that comes
 * back in as an event through `dispatch`.
 */
export function useRun({ initial, checkAvailability }: Options) {
  const [state, dispatch] = useReducer(reduce, initial ?? INITIAL);
  // What is going on right now, kept outside React state because changing it
  // must not re-draw anything: the way to cancel it, and the way to skip ahead.
  const cancel = useRef<AbortController | null>(null);
  const skipper = useRef<(() => void) | null>(null);

  // A live run and a replay report through the same four calls.
  const handlers = useMemo<RunHandlers>(
    () => ({
      onQueued: () => dispatch({ type: "queued" }),
      onStep: (step) => dispatch({ type: "step", step }),
      onDone: (result) => dispatch({ type: "finished", result }),
      onFailed: (code) => dispatch({ type: "failed", code }),
    }),
    [],
  );

  /** Stop whatever is going and hand back a fresh way to cancel the next thing. */
  const fresh = useCallback(() => {
    cancel.current?.abort();
    skipper.current = null;
    cancel.current = new AbortController();
    return cancel.current.signal;
  }, []);

  // Leaving the page cancels the request and clears the replay's timers.
  useEffect(() => () => cancel.current?.abort(), []);

  const startLive = useCallback(
    (input: Input, token: string) => {
      const form = new FormData();
      if (input.mode === "file" && input.file) form.set("resume_file", input.file);
      else form.set("resume_text", input.resumeText);
      form.set("jd_text", input.jobText);
      form.set("turnstile_token", token);
      const signal = fresh();
      dispatch({ type: "started", source: "live", at: Date.now() });
      void startRun(form, handlers, signal);
    },
    [fresh, handlers],
  );

  const startReplay = useCallback(
    ({ speed }: ReplayStart = {}) => {
      const signal = fresh();
      dispatch({ type: "started", source: "replay", at: Date.now() });
      skipper.current = playReplay(EXAMPLE_RUN, handlers, { speed, signal }).skip;
    },
    [fresh, handlers],
  );

  /** Jump a replay to its end. Does nothing during a live run. */
  const skip = useCallback(() => skipper.current?.(), []);

  // While a live run is going, closing the tab or following a link would throw
  // it away, along with one of the day's few runs. Ask first.
  const liveRunGoing = state.status === "running" && state.source === "live";
  useEffect(() => {
    setLiveRunGoing(liveRunGoing); // read by SiteLink for in-site links
    if (!liveRunGoing) return;
    const warn = (event: BeforeUnloadEvent) => {
      // This makes the browser show its own "Leave site?" box. Browsers do not
      // allow a custom message there. returnValue is the older way to ask for
      // the same thing, still needed by some.
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      setLiveRunGoing(false);
    };
  }, [liveRunGoing]);

  // Ask once whether a live run can start. If today's runs are gone, the
  // visitor is told before they upload anything, and offered the recording.
  useEffect(() => {
    // The owner's runs are not counted, so the limit does not apply to them.
    if (!checkAvailability || hasOwnerKey()) return;
    const asking = new AbortController();
    void fetchAvailability(asking.signal).then((value) => {
      if (!asking.signal.aborted) dispatch({ type: "availability", value });
    });
    return () => asking.abort();
  }, [checkAvailability]);

  return { state, dispatch, startLive, startReplay, skip };
}
