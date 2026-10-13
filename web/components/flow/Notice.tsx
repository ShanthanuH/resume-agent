"use client";

import { useSyncExternalStore } from "react";
import { copy, fill } from "@/lib/copy";
import { nextResetTime } from "@/lib/format";
import { errorSentence } from "@/lib/steps";
import type { ErrorCode } from "@/lib/types";
import { outlineButton, primaryButton } from "../ui";

type Props =
  | { kind: "limited"; scope: "site" | "visitor"; onWatch: () => void }
  | { kind: "paused"; onWatch: () => void }
  | { kind: "error"; code: ErrorCode; onRetry: () => void; onWatch: () => void };

// The reset time depends on the visitor's clock and time zone, which the server
// does not know. useSyncExternalStore is React's way to say "this value only
// exists in the browser": "" on the server, the real time once the page is live.
const noChange = () => () => {};
const useResetTime = () => useSyncExternalStore(noChange, () => nextResetTime(), () => "");

/**
 * What takes the form's place when a run cannot start or did not finish:
 * today's runs are gone, the live demo is paused, or something failed. Each
 * says what happened in one line and offers the next thing to do. When the
 * visitor cannot run their own resume, that next thing is the recorded run.
 */
export function Notice(props: Props) {
  const time = useResetTime();
  let title: string;
  let text: string;
  if (props.kind === "limited") {
    title = props.scope === "site" ? copy.limited_site_title : copy.limited_visitor_title;
    text = fill(copy.limited_text, { time });
  } else if (props.kind === "paused") {
    title = copy.paused_title;
    text = copy.paused_text;
  } else {
    title = copy.error_title;
    text = errorSentence(props.code);
  }

  return (
    // role="alert" makes screen readers read this as soon as it appears.
    <section role="alert" className="mx-auto w-full max-w-xl">
      <h1 tabIndex={-1} data-focus className="display text-[2rem] outline-none sm:text-[2.5rem]">
        {title}
      </h1>
      <p className="mt-3 text-lg text-soft">{text}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {props.kind === "error" ? (
          <>
            <button type="button" onClick={props.onRetry} className={primaryButton}>
              {copy.error_retry}
            </button>
            <button type="button" onClick={props.onWatch} className={outlineButton}>
              {copy.watch_run}
            </button>
          </>
        ) : (
          <button type="button" onClick={props.onWatch} className={primaryButton}>
            {copy.watch_run}
          </button>
        )}
      </div>
    </section>
  );
}
