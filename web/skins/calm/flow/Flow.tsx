"use client";

import { useFlow, type FlowOptions } from "@/components/flow/useFlow";
import { copy } from "@/lib/copy";
import { InputForm } from "./InputForm";
import { Notice } from "./Notice";
import { ResultView } from "./ResultView";
import { Running } from "./Running";

const EXAMPLE_PDF = "/example.pdf"; // the recorded run's result, with every rewrite in

/**
 * The whole flow on one screen, with no page reloads: the form, the wait, the
 * result, and the three ways it can go wrong. Which of them shows is decided
 * by the state machine alone (through useFlow); this component only draws.
 */
export function Flow(props: FlowOptions) {
  const { state, dispatch, top, screen, isExample, submit, onToken, waiting, skip, watch, speed } = useFlow(props);
  const editing = state.status === "idle" || state.status === "ready";

  return (
    // A minimum height, so a short screen does not pull the footer up.
    <div ref={top} className="min-h-[72svh]">
      {/* The key makes each screen a new element, so its entrance plays. */}
      <div key={screen}>
        {screen === "form" && editing && (
          <InputForm state={state} dispatch={dispatch} onSubmit={submit} onToken={onToken} waiting={waiting} />
        )}
        {screen === "running" && (
          <Running
            steps={state.status === "running" ? state.steps : []}
            queued={state.status === "running" && state.queued}
            startedAt={state.status === "running" ? state.startedAt : null}
            source={state.status === "running" ? state.source : "replay"}
            onSkip={skip}
            speed={speed}
          />
        )}
        {state.status === "done" && (
          <ResultView
            result={state.result}
            steps={state.steps}
            source={state.source}
            // The recorded run comes with its PDF. A live result is drawn on request.
            staticPdf={state.source === "replay" ? EXAMPLE_PDF : undefined}
            onAgain={isExample ? watch : () => dispatch({ type: "reset" })}
            againLabel={isExample ? copy.replay_again : copy.result_start_over}
          />
        )}
        {state.status === "limited" && <Notice kind="limited" scope={state.scope} onWatch={watch} />}
        {state.status === "paused" && <Notice kind="paused" onWatch={watch} />}
        {state.status === "error" && (
          <Notice kind="error" code={state.code} onRetry={() => dispatch({ type: "retry" })} onWatch={watch} />
        )}
      </div>
    </div>
  );
}
