"use client";

import { useSyncExternalStore } from "react";
import { copy, fill } from "@/lib/copy";
import { nextResetTime } from "@/lib/format";
import { errorSentence } from "@/lib/steps";
import type { ErrorCode } from "@/lib/types";
import { chapter, inkButton, page, quietLink } from "../ui";

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
 *
 * The whole screen takes one colour. Orange is the site's colour for "went
 * wrong"; cornflower is the colour of the recorded run, which is what the
 * limit and pause screens lead to.
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
    <section role="alert" className={props.kind === "error" ? "field-left-out" : "field-recorded"}>
      <div className={`${page} ${chapter} flex min-h-[72svh] flex-col justify-end`}>
        <h1 tabIndex={-1} data-focus className="head max-w-[14ch] outline-none">
          {title}
        </h1>
        <p className="lead mt-6 max-w-[34ch]">{text}</p>
        <div className="mt-10 flex flex-col gap-x-8 gap-y-2 sm:flex-row sm:items-center">
          {props.kind === "error" ? (
            <>
              <button type="button" onClick={props.onRetry} className={inkButton}>
                {copy.error_retry}
              </button>
              <button type="button" onClick={props.onWatch} className={`${quietLink} justify-center font-medium`}>
                {copy.watch_run}
              </button>
            </>
          ) : (
            <button type="button" onClick={props.onWatch} className={inkButton}>
              {copy.watch_run}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
