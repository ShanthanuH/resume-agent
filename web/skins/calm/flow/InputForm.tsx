"use client";

import type { Dispatch } from "react";
import type { RunEvent, RunState } from "@/lib/run-machine";

// PLACEHOLDER: subagent B replaces this. The props are the contract.
export type InputFormProps = {
  state: Extract<RunState, { status: "idle" | "ready" }>;
  dispatch: Dispatch<RunEvent>;
  onSubmit: () => void;
  onToken: (token: string) => void;
  waiting: boolean; // the button was pressed before the bot check finished
};

export function InputForm(props: InputFormProps) {
  void props;
  return <div />;
}
