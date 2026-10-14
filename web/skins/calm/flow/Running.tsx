"use client";

import type { Source } from "@/lib/run-machine";
import type { Step } from "@/lib/types";

// PLACEHOLDER: subagent B replaces this. The props are the contract.
export type RunningProps = {
  steps: Step[];
  queued: boolean;
  startedAt: number | null;
  source: Source;
  onSkip: () => void;
  speed: number;
};

export function Running(props: RunningProps) {
  void props;
  return <div />;
}
