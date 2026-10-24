"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useFlow, type FlowOptions } from "@/components/flow/useFlow";
import { EXAMPLE_RUN } from "@/lib/example";
import { jobHeading } from "@/lib/job-heading";
import { HeroForm } from "../landing/HeroForm";
import { Landing } from "../landing/Landing";
import { HeroPreload } from "../parts";
import { IDS } from "./contracts";

// The screens after the form are loaded only when they are needed, so the
// home page's first load carries the form and nothing else. On the server
// they are still drawn in full (the states pages open on them).
const RunningScreen = dynamic(() => import("../running/RunningScreen").then((m) => m.RunningScreen));
const RunningCard = dynamic(() => import("../running/RunningCard").then((m) => m.RunningCard));
const NoticeCard = dynamic(() => import("../running/NoticeCard").then((m) => m.NoticeCard));
const ResultView = dynamic(() => import("../result/ResultView").then((m) => m.ResultView));

const EXAMPLE_PDF = "/example.pdf"; // the recorded run's result, with every rewrite in

type Props = FlowOptions & {
  /**
   * The landing sections under the hero. The home page draws them on the
   * server and passes them in, so they are not part of this component's code.
   */
  sections?: ReactNode;
  /** A note at the top of the running and result screens (the recorded-run page). */
  note?: ReactNode;
};

/**
 * The calm skin's flow, on one page with no reloads: the landing page with
 * its form, the running card, the result, and the notices. Which one shows is
 * decided by the state machine alone (through useFlow); this component picks
 * the screen and hands each one its props. The screens only draw.
 */
export function Flow({ sections = null, note, ...options }: Props) {
  const { state, dispatch, top, screen, isExample, submit, onToken, waiting, skip, watch, speed } = useFlow(options);
  const router = useRouter();

  // Fetch the later screens once the page is idle, so pressing the button
  // never waits for them.
  useEffect(() => {
    const warm = () => {
      void import("../running/RunningCard");
      void import("../running/NoticeCard");
      void import("../result/ResultView");
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(warm, 2000);
    return () => clearTimeout(timer);
  }, []);

  // "Try another job post" sets this, so the job post box gets the cursor once
  // the form is back on screen.
  const focusJob = useRef(false);
  useEffect(() => {
    if (screen !== "form" || !focusJob.current) return;
    focusJob.current = false;
    const box = document.getElementById(IDS.job);
    box?.scrollIntoView({ block: "center" });
    box?.focus({ preventScroll: true });
  }, [screen]);

  function tryAnother() {
    // The recorded-run page has no form of its own: go to the home page's.
    if (isExample) return router.push(`/#${IDS.start}`);
    dispatch({ type: "reset" }); // back to the form, the resume kept
    dispatch({ type: "job_typed", text: "" });
    focusJob.current = true;
  }

  function hero(card: ReactNode, facts = false) {
    return <Landing heroCard={card} sections={sections} facts={facts} />;
  }

  let view: ReactNode = null;
  if (state.status === "idle" || state.status === "ready") {
    view = hero(<HeroForm state={state} dispatch={dispatch} onSubmit={submit} onToken={onToken} waiting={waiting} />, true);
  }
  // The recorded-run page never shows the form: before its replay has begun
  // (the first instant, and the server-drawn page) it shows an empty wait.
  if (screen === "running") {
    const running = state.status === "running" ? state : null;
    view = (
      <RunningScreen note={note}>
        <RunningCard
          steps={running?.steps ?? []}
          queued={running?.queued ?? false}
          startedAt={running?.startedAt ?? 0}
          source={running?.source ?? "replay"}
          speed={speed}
          onSkip={skip}
        />
      </RunningScreen>
    );
  }
  if (state.status === "done") {
    // A replay's result is the recorded run, whatever was typed in the form.
    const jobText = state.source === "replay" ? EXAMPLE_RUN.jd_text : state.input.jobText;
    view = (
      <ResultView
        result={state.result}
        source={state.source}
        job={jobHeading(jobText)}
        staticPdf={state.source === "replay" ? EXAMPLE_PDF : undefined}
        onTryAnother={tryAnother}
        note={note}
      />
    );
  }
  // Before a run: in the hero, where the form would be. A failed run: in the
  // running card's place.
  if (state.status === "limited") view = hero(<NoticeCard kind="limited" onWatch={watch} />);
  if (state.status === "paused") view = hero(<NoticeCard kind="paused" onWatch={watch} />);
  if (state.status === "error") {
    view = (
      <RunningScreen note={note}>
        <NoticeCard kind="error" code={state.code} onRetry={() => dispatch({ type: "retry" })} />
      </RunningScreen>
    );
  }

  return (
    <div ref={top}>
      <HeroPreload />
      {view}
    </div>
  );
}
