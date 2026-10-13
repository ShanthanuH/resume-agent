"use client";

import { useState } from "react";
import { copy } from "@/lib/copy";
import { EXAMPLE_RUN } from "@/lib/example";
import { EMPTY_INPUT, type Input, type RunState } from "@/lib/run-machine";
import type { StateName } from "@/lib/states";
import { Flow } from "./flow/Flow";

// The states page (preview builds only) opens the flow straight in one named
// state, so its design can be looked at, and screenshots taken, without a live
// run. This file builds the state for each name.

/** A stand-in resume file of a given size. It is never read or sent anywhere. */
function fakeFile(name: string, bytes: number): File {
  return new File([new ArrayBuffer(bytes)], name, { type: "application/pdf" });
}

function build(name: StateName): { variant: "try" | "example"; initial?: RunState; speed?: number } {
  const filled: Input = {
    ...EMPTY_INPUT,
    file: fakeFile("meera-kulkarni-resume.pdf", 84_000),
    jobText: EXAMPLE_RUN.jd_text,
  };
  const done = { status: "done", source: "replay", steps: EXAMPLE_RUN.steps, input: EMPTY_INPUT, block: null } as const;
  switch (name) {
    case "file-added":
      return { variant: "try", initial: { status: "ready", input: filled, block: null } };
    case "bad-file-scan": {
      const input: Input = { ...filled, file: fakeFile("scanned-resume.pdf", 610_000), fileProblem: "file_no_text" };
      return { variant: "try", initial: { status: "idle", touched: true, serverProblem: null, input, block: null } };
    }
    case "bad-file-big": {
      const input: Input = { ...filled, file: fakeFile("resume-with-photos.pdf", 3_400_000), fileProblem: "file_too_big" };
      return { variant: "try", initial: { status: "idle", touched: false, serverProblem: null, input, block: null } };
    }
    case "running":
      return { variant: "example" }; // the recorded run, at its real speed
    case "running-fast":
      return { variant: "example", speed: 8 };
    case "done":
      return { variant: "example", initial: { ...done, result: EXAMPLE_RUN.result } };
    case "done-question": {
      const result = { ...EXAMPLE_RUN.result, questions: [copy.states_sample_question] };
      return { variant: "example", initial: { ...done, result } };
    }
    case "error":
      return { variant: "try", initial: { status: "error", code: "model_error", input: filled, block: null } };
    case "limited":
      return {
        variant: "try",
        initial: { status: "limited", scope: "site", input: EMPTY_INPUT, block: { status: "limited", scope: "site" } },
      };
    case "limited-visitor":
      return {
        variant: "try",
        initial: {
          status: "limited",
          scope: "visitor",
          input: EMPTY_INPUT,
          block: { status: "limited", scope: "visitor" },
        },
      };
    case "paused":
      return { variant: "try", initial: { status: "paused", input: EMPTY_INPUT, block: { status: "paused" } } };
  }
}

/** The flow, opened in one named state. */
export function StateDemo({ name }: { name: StateName }) {
  // Built once: the flow must be handed the same starting state on every draw.
  const [demo] = useState(() => build(name));
  return <Flow {...demo} />;
}
