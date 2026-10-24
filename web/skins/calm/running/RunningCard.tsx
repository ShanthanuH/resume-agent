"use client";

import { useEffect, useId, useState } from "react";
import { useElapsed } from "@/components/flow/useElapsed";
import { copy, fill } from "@/lib/copy";
import { fiveSteps, progressOf } from "@/lib/five-steps";
import { clock } from "@/lib/format";
import type { RunningCardProps } from "../flow/contracts";
import { CheckIcon, Glass, PlaneIcon, Switch } from "../parts";

const STORE_KEY = "calm-show-steps";

/** The progress of a run: the bar, the clock, the five steps. */
export function RunningCard({ steps, queued, startedAt, source, speed, onSkip }: RunningCardProps) {
  const { done, resumeLines, jobAsks } = fiveSteps(steps);
  const current = Math.min(done, 4);
  const labelId = useId();

  // The bar fill: eases inside the current step, and never goes backwards.
  const [fillAmount, setFillAmount] = useState(() => progressOf(current, 0));
  useEffect(() => {
    const since = performance.now(); // when this step began
    let frame = 0;
    const tick = () => {
      const seconds = ((performance.now() - since) / 1000) * speed;
      setFillAmount((before) => Math.max(before, progressOf(current, seconds)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [current, speed]);

  const elapsed = useElapsed(startedAt, speed);

  // The list is on by default. The saved choice is read after the first render
  // so the server page and the first client page match.
  const [showSteps, setShowSteps] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(STORE_KEY) === "off") setShowSteps(false); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      /* storage blocked: keep the default */
    }
  }, []);
  function chooseShow(on: boolean) {
    setShowSteps(on);
    try {
      localStorage.setItem(STORE_KEY, on ? "on" : "off");
    } catch {
      /* not saved; the switch still works */
    }
  }

  const texts = [
    done >= 1 ? fill(copy.calm_run_step_1, { count: resumeLines ?? 0 }) : copy.calm_run_step_1_now,
    done >= 2 ? fill(copy.calm_run_step_2, { count: jobAsks ?? 0 }) : copy.calm_run_step_2_now,
    copy.calm_run_step_3,
    copy.calm_run_step_4,
    copy.calm_run_step_5,
  ];
  const percent = `${(fillAmount * 100).toFixed(1)}%`;

  return (
    <Glass tone="photo" role="status" aria-live="polite" className="flex flex-col gap-4 rounded-[28px] px-[22px] py-6">
      <h1
        tabIndex={-1}
        data-focus
        className="m-0 font-serif text-[34px] leading-[1.05] font-normal outline-none wide:text-[40px]"
      >
        {copy.calm_run_title}
      </h1>

      {/* The bar and the clock change every moment: only step changes are announced. */}
      <div aria-hidden className="relative h-7">
        <div className="absolute inset-x-0 top-[13px] border-t-2 border-dashed border-[rgba(11,35,64,.35)]" />
        <div className="absolute top-3 left-0 h-1 rounded bg-ink-900" style={{ width: percent }} />
        <PlaneIcon className="fly absolute top-[14px]" style={{ left: percent }} />
      </div>
      <div className="flex justify-between text-sm font-semibold text-ink-700">
        <span>{fill(copy.calm_run_step_of, { step: current + 1 })}</span>
        <span aria-hidden>{clock(elapsed)}</span>
      </div>
      <p className="m-0 text-[15px] leading-normal text-ink-700">{copy.calm_run_hint}</p>
      {queued ? <p className="m-0 text-[15px] leading-normal font-semibold text-ink-900">{copy.run_queued}</p> : null}

      <div aria-hidden className="h-px bg-[rgba(11,35,64,.12)]" />
      <div className="flex items-center justify-between">
        <span id={labelId} className="text-[15px] font-semibold">
          {copy.calm_run_show_steps}
        </span>
        <Switch checked={showSteps} onChange={chooseShow} labelledBy={labelId} />
      </div>

      {showSteps ? (
        <ol className="m-0 flex list-none flex-col gap-3 p-0 text-[15px]">
          {texts.map((text, i) => {
            const state = i < done ? "done" : i === current ? "now" : "later";
            return (
              <li
                key={i}
                aria-current={state === "now" ? "step" : undefined}
                className={`flex items-center gap-3 ${state === "now" ? "font-bold" : ""} ${state === "later" ? "text-ink-500" : ""}`}
              >
                <StepMark state={state} />
                {text}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="m-0 text-[15px] font-bold">{texts[current]}</p>
      )}

      {source === "replay" ? (
        <button
          type="button"
          onClick={onSkip}
          className="min-h-11 self-start text-[15px] font-semibold text-ink-700 underline underline-offset-4 hover:text-ink-900"
        >
          {copy.replay_skip}
        </button>
      ) : null}
    </Glass>
  );
}

/** The circle before a step: a check when done, a pulsing dot now, empty later. */
function StepMark({ state }: { state: "done" | "now" | "later" }) {
  if (state === "done") {
    return (
      <span aria-hidden className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-ink-900">
        <CheckIcon />
      </span>
    );
  }
  if (state === "now") {
    return (
      <span aria-hidden className="pulse box-border flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 border-ink-900">
        <span className="size-2 rounded-full bg-ink-900" />
      </span>
    );
  }
  return <span aria-hidden className="box-border size-[22px] shrink-0 rounded-full border-[1.5px] border-[rgba(11,35,64,.35)]" />;
}
