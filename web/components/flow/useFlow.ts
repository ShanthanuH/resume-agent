"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REPLAY_ONLY, TURNSTILE_SITE_KEY } from "@/lib/config";
import { takeHandedOver } from "@/lib/handoff";
import type { RunState } from "@/lib/run-machine";
import { useRun } from "./useRun";

export type FlowOptions = {
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

/** Which screen of the flow is on show. */
export type Screen = "form" | Exclude<RunState["status"], "idle" | "ready">;

const BOT_CHECK_PATIENCE_MS = 20_000; // how long the button waits for the bot check

/**
 * Everything the flow does, for any skin: the run, the bot check, the button,
 * the hand-over from the home page, and moving focus when the screen changes.
 * A skin's Flow component calls this and only draws what it returns.
 */
export function useFlow({ variant, initial, speed = 1 }: FlowOptions) {
  const isExample = variant === "example";
  const { state, dispatch, startLive, startReplay, skip } = useRun({
    initial,
    // No live run can start from the recorded-run page or on a preview build.
    checkAvailability: !isExample && !REPLAY_ONLY && !initial,
  });
  /** Put this on the box around the flow: focus and scrolling use it. */
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

  // If the visitor already pressed the button on the home page, press it here
  // once, on the first draw after their fields are in (a field still missing
  // something then shows its message, as if pressed here). This effect comes
  // before the hand-over below on purpose: effects run in order, so on the
  // draw where the hand-over happens this one has already looked and passed.
  const pressAfterHandOver = useRef(false);
  useEffect(() => {
    if (!pressAfterHandOver.current) return;
    pressAfterHandOver.current = false;
    submit();
  });

  // Something chosen on the home page is waiting: take it in.
  useEffect(() => {
    if (isExample || initial) return;
    const handed = takeHandedOver();
    if (!handed) return;
    if (handed.file) dispatch({ type: "file_added", file: handed.file });
    if (handed.resumeText) {
      dispatch({ type: "mode_set", mode: "text" });
      dispatch({ type: "resume_typed", text: handed.resumeText });
    }
    if (handed.jobText) dispatch({ type: "job_typed", text: handed.jobText });
    if (handed.start) pressAfterHandOver.current = true;
  }, [isExample, initial, dispatch]);

  // The recorded-run page starts playing by itself.
  useEffect(() => {
    if (isExample && !initial) startReplay({ speed });
  }, [isExample, initial, speed, startReplay]);

  // The form of the recorded-run page is never shown: before its replay has
  // begun (the first instant, and the server-drawn page) it shows the wait.
  const editing = state.status === "idle" || state.status === "ready";
  const screen: Screen = editing ? (isExample ? "running" : "form") : (state.status as Screen);

  // When the screen changes, bring its top into view and move keyboard focus
  // to its heading (the element with data-focus), so a screen-reader user
  // hears where they now are.
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

  /** Play the recorded run: from a notice, or again on the example page. */
  const watch = () => startReplay({ speed });

  return { state, dispatch, top, screen, isExample, submit, onToken, waiting, skip, watch, speed };
}
