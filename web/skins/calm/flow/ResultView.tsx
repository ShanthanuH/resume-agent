"use client";

import type { Source } from "@/lib/run-machine";
import type { Result, Step } from "@/lib/types";

// PLACEHOLDER: subagent C replaces this. The props are the contract.
export type ResultViewProps = {
  result: Result;
  steps: Step[];
  source: Source;
  onAgain: () => void; // start over, or play the recording again
  againLabel: string;
  staticPdf?: string; // a ready-made PDF of the result (the recorded run has one)
};

export function ResultView(props: ResultViewProps) {
  void props;
  return <div />;
}
