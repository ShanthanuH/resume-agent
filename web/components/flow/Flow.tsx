"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REPLAY_ONLY, TURNSTILE_SITE_KEY } from "@/lib/config";
import { copy } from "@/lib/copy";
import { takeHandedOver } from "@/lib/handoff";
import type { RunState } from "@/lib/run-machine";
import { InputForm } from "./InputForm";
import { Notice } from "./Notice";
import { ResultView } from "./ResultView";
import { Running } from "./Running";
import { useRun } from "./useRun";

type Props = {
  /**
   * "try" is the product: the form, then a live run on the visitor's resume.
   * "example" is the recorded run: it starts playing as soon as the page opens.
   */
  variant: "try" | "example";
  /** Open on this state instead of the start. Only the states page sets it. */
  initial?: RunState;
  /** How fast the recorded run plays. 1 is its real speed. */
  speed?: number;
};

const EXAMPLE_PDF = "/example.pdf"; // the recorded run's result, with every rewrite in
const BOT_CHECK_PATIENCE_MS = 20_000; // how long the button waits for the bot check

/**
 * The whole flow on one screen, with no page reloads: the form, the wait, the
 * result, and the three ways it can go wrong. Which of them shows is decided
 * by the state machine alone; this component only draws the state it is given.
 */
export function Flow({ variant, initial, speed = 1 }: Props) {
  const isExample = variant === "example";
  const { state, dispatch, startLive, startReplay, skip } = useRun({
    initial,
    // No live run can start from the recorded-run page or on a preview build.
    checkAvailability: !isExample && !REPLAY_ONLY && !initial,
  });
  const top = useRef<HTMLDivElement>(null);

  // --- The bot check. Its token is needed to start a live run. ---
  const [token, setToken] = useState("");
  // True when the button was pressed before the token arrived. The run then
  // starts by itself as soon as it does, so the visitor never presses twice.
  const [waiting, setWaiting] = useState(false);
  // The newest values, readable from onToken without re-creating it. A new
  // onToken would make the bot check throw away its widget and start again.
  const ready = state.status === "ready";
  const latest = useRef({ waiting, ready, input: state.input, startLive });
  useEffect(() => {
    latest.current = { waiting, ready, input: state.input, startLive };
  });

  // Called by the bot check with a token, or with "" when it expired or failed.
  const onToken = useCallback((value: string) => {
    const now = latest.current;
    if (now.waiting) {
      setWaiting(false);
      // "ready" is checked again: the visitor may have emptied a field while
      // waiting. With a token the run starts. With "" the bot check has failed:
      // the run is sent anyway, the server refuses it, and the error screen
      // says what to do. Either way the token, if any, is used up here.
      if (now.ready) return now.startLive(now.input, value);
    }
    setToken(value);
  }, []);

  // If the bot check never answers (its script was blocked, say), do not leave
  // the visitor looking at a waiting button for ever. Send the run without a
  // token: the server refuses it, and the error screen says what to do.
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setWaiting(false);
      if (latest.current.ready) latest.current.startLive(latest.current.input, "");
    }, BOT_CHECK_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  function submit() {
    if (state.status === "idle") {
      dispatch({ type: "submit_pressed" });
      // After the fields have drawn their messages, put the cursor in the
      // first one that has a problem.
      requestAnimationFrame(() => top.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (state.status !== "ready") return;
    if (REPLAY_ONLY) return startReplay({ speed });
    if (TURNSTILE_SITE_KEY && !token) return setWaiting(true);
    startLive(state.input, token);
    setToken(""); // a token works once
  }

  // A file chosen in the last chapter of the home page is waiting: take it in.
  useEffect(() => {
    if (isExample || initial) return;
    const file = takeHandedOver();
    if (file) dispatch({ type: "file_added", file });
  }, [isExample, initial, dispatch]);

  // The recorded-run page starts playing by itself.
  useEffect(() => {
    if (isExample && !initial) startReplay({ speed });
  }, [isExample, initial, speed, startReplay]);

  // The form of the recorded-run page is never shown: before its replay has
  // begun (the first instant, and the server-drawn page) it shows the wait.
  const editing = state.status === "idle" || state.status === "ready";
  const screen = editing ? (isExample ? "running" : "form") : state.status;

  // When the screen changes, bring its top into view and move keyboard focus
  // to its heading, so a screen-reader user hears where they now are.
  const shown = useRef(screen); // the screen that was on show before this draw
  useEffect(() => {
    // Only when the screen really changed. Not on page load (that would steal
    // focus), and not when React runs this effect a second time in development.
    if (shown.current === screen) return;
    shown.current = screen;
    if (screen === "form") return; // back at the form: leave the cursor alone
    const box = top.current;
    if (!box) return;
    if (box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: "start" });
    box.querySelector<HTMLElement>("[data-focus]")?.focus({ preventScroll: true });
  }, [screen]);

  const watch = () => startReplay({ speed });

  return (
    // A minimum height, so that a short screen (the wait, a notice) does not pull
    // the footer up and a long one push it back down as the flow moves along.
    // Each screen is its own field of colour, edge to edge, so this box has no
    // width or padding of its own.
    <div ref={top} className="min-h-[72svh]">
      {/* The key makes each screen a new element, so its entrance animation plays. */}
      <div key={screen}>
        {screen === "form" && editing && (
          <InputForm state={state} dispatch={dispatch} onSubmit={submit} onToken={onToken} waiting={waiting} />
        )}
        {screen === "running" && (
          <Running
            steps={state.status === "running" ? state.steps : []}
            queued={state.status === "running" && state.queued}
            startedAt={state.status === "running" ? state.startedAt : null}
            source={state.status === "running" ? state.source : "replay"}
            onSkip={skip}
            speed={speed}
          />
        )}
        {state.status === "done" && (
          <ResultView
            result={state.result}
            steps={state.steps}
            source={state.source}
            // The recorded run comes with its PDF. A live result is drawn on request.
            staticPdf={state.source === "replay" ? EXAMPLE_PDF : undefined}
            onAgain={isExample ? watch : () => dispatch({ type: "reset" })}
            againLabel={isExample ? copy.replay_again : copy.result_start_over}
          />
        )}
        {state.status === "limited" && <Notice kind="limited" scope={state.scope} onWatch={watch} />}
        {state.status === "paused" && <Notice kind="paused" onWatch={watch} />}
        {state.status === "error" && (
          <Notice kind="error" code={state.code} onRetry={() => dispatch({ type: "retry" })} onWatch={watch} />
        )}
      </div>
    </div>
  );
}
