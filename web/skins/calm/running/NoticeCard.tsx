"use client";

import { copy } from "@/lib/copy";
import type { NoticeCardProps } from "../flow/contracts";
import { Glass } from "../parts";

/** Why no run is going: the daily limit, a pause, or a failed run. */
export function NoticeCard(props: NoticeCardProps) {
  let title: string;
  let body: string;
  let action: { label: string; run: () => void };

  if (props.kind === "limited") {
    title = copy.calm_limit_title;
    body = copy.calm_limit_body;
    action = { label: copy.calm_see_example, run: props.onWatch };
  } else if (props.kind === "paused") {
    title = copy.calm_paused_title;
    body = copy.calm_paused_body;
    action = { label: copy.calm_see_example, run: props.onWatch };
  } else if (props.code === "bot_check") {
    title = copy.calm_bot_title;
    body = copy.calm_bot_body;
    action = { label: copy.calm_reload, run: () => window.location.reload() };
  } else {
    title = copy.calm_err_run_title;
    body =
      props.code === "timeout"
        ? copy.calm_err_timeout
        : props.code === "offline"
          ? copy.calm_err_offline
          : copy.calm_err_run_body;
    action = { label: copy.calm_err_retry, run: props.onRetry };
  }

  return (
    <Glass tone="photo" role="status" className="flex flex-col gap-4 rounded-[28px] px-[22px] py-6">
      <h2 tabIndex={-1} data-focus className="m-0 font-serif text-[34px] leading-[1.05] font-normal outline-none wide:text-[40px]">
        {title}
      </h2>
      <p className="m-0 text-[15px] leading-normal text-ink-700">{body}</p>
      <button type="button" onClick={action.run} className="ink min-h-[54px] rounded-2xl px-6 text-base font-semibold text-white">
        {action.label}
      </button>
    </Glass>
  );
}
