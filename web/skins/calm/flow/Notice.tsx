"use client";

import type { ErrorCode } from "@/lib/types";

// PLACEHOLDER: subagent D replaces this. The props are the contract.
export type NoticeProps =
  | { kind: "limited"; scope: "site" | "visitor"; onWatch: () => void }
  | { kind: "paused"; onWatch: () => void }
  | { kind: "error"; code: ErrorCode; onRetry: () => void; onWatch: () => void };

export function Notice(props: NoticeProps) {
  void props;
  return <div />;
}
