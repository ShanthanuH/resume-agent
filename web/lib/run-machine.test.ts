import { describe, expect, test } from "vitest";
import { MAX_FILE_BYTES } from "./config";
import { EXAMPLE_RUN } from "./example";
import { INITIAL, phaseOf, reduce, type RunEvent, type RunState } from "./run-machine";
import type { Step, StepKind } from "./types";

const JOB = "j".repeat(300); // long enough to count as a job post
const pdf = (bytes = 1000, name = "resume.pdf") => new File([new ArrayBuffer(bytes)], name, { type: "application/pdf" });

/** Feed a list of events through the machine, starting from `from`. */
function run(events: RunEvent[], from: RunState = INITIAL): RunState {
  return events.reduce(reduce, from);
}

/** A state with both inputs filled in. */
const ready = () => run([{ type: "file_added", file: pdf() }, { type: "job_typed", text: JOB }]);
const running = (source: "live" | "replay" = "live") => run([{ type: "started", source, at: 1000 }], ready());

describe("the inputs", () => {
  test("it starts idle, and is ready only when both inputs are fine", () => {
    expect(INITIAL.status).toBe("idle");
    expect(run([{ type: "file_added", file: pdf() }]).status).toBe("idle"); // no job post yet
    expect(run([{ type: "job_typed", text: JOB }]).status).toBe("idle"); // no resume yet
    expect(ready().status).toBe("ready");
    expect(run([{ type: "file_removed" }], ready()).status).toBe("idle");
  });

  test("a file over 2 MB or of the wrong kind is refused at once, and kept for its name", () => {
    const big = run([{ type: "file_added", file: pdf(MAX_FILE_BYTES + 1) }, { type: "job_typed", text: JOB }]);
    expect(big.status).toBe("idle");
    expect(big.input.fileProblem).toBe("file_too_big");
    expect(big.input.file?.name).toBe("resume.pdf");
    const word = new File(["x"], "resume.docx", { type: "application/msword" });
    expect(run([{ type: "file_added", file: word }]).input.fileProblem).toBe("file_not_pdf");
    // A good file replaces a bad one and clears the problem.
    expect(run([{ type: "file_added", file: pdf() }], big).status).toBe("ready");
  });

  test("a PDF with no type is accepted by its name", () => {
    const untyped = new File(["x"], "My Resume.PDF", { type: "" });
    expect(run([{ type: "file_added", file: untyped }]).input.fileProblem).toBeNull();
  });

  test("pasted text works in place of a file", () => {
    const pasted = run([
      { type: "mode_set", mode: "text" },
      { type: "resume_typed", text: "r".repeat(300) },
      { type: "job_typed", text: JOB },
    ]);
    expect(pasted.status).toBe("ready");
    // Too short is not ready, and neither is a job post that is too short.
    expect(run([{ type: "resume_typed", text: "short" }], pasted).status).toBe("idle");
    expect(run([{ type: "job_typed", text: "short" }], pasted).status).toBe("idle");
  });

  test("pressing the button with something missing makes the fields speak up", () => {
    const pressed = run([{ type: "submit_pressed" }]);
    expect(pressed).toMatchObject({ status: "idle", touched: true });
    // It stays that way while the visitor fixes things, until both are fine.
    expect(run([{ type: "job_typed", text: "short" }], pressed)).toMatchObject({ status: "idle", touched: true });
  });
});

describe("a run", () => {
  test("idle -> ready -> running -> done", () => {
    const going = running();
    expect(going).toMatchObject({ status: "running", source: "live", startedAt: 1000, steps: [] });
    const step: Step = { n: 1, kind: "read_resume", ms: 10, count: 3 };
    const result = EXAMPLE_RUN.result;
    const done = run([{ type: "step", step }, { type: "finished", result }], going);
    expect(done).toMatchObject({ status: "done", source: "live", steps: [step], result });
  });

  test("a live run cannot start from incomplete inputs, and two runs cannot overlap", () => {
    expect(run([{ type: "started", source: "live", at: 1 }]).status).toBe("idle");
    const second = run([{ type: "started", source: "replay", at: 2000 }], running());
    expect(second).toMatchObject({ status: "running", source: "live", startedAt: 1000 });
  });

  test("the inputs cannot change under a run that is going", () => {
    const going = running();
    expect(run([{ type: "job_typed", text: "x" }, { type: "file_removed" }], going)).toBe(going);
  });

  test("queued shows until the first step arrives", () => {
    const queued = run([{ type: "queued" }], running());
    expect(queued).toMatchObject({ status: "running", queued: true });
    const moving = run([{ type: "step", step: { n: 1, kind: "read_resume", ms: 1 } }], queued);
    expect(moving).toMatchObject({ status: "running", queued: false });
  });

  test("start over goes back to the inputs, which are still there", () => {
    const done = run([{ type: "finished", result: EXAMPLE_RUN.result }], running());
    const again = run([{ type: "reset" }], done);
    expect(again.status).toBe("ready");
    expect(again.input.jobText).toBe(JOB);
  });
});

describe("when a run does not finish", () => {
  const failed = (code: Parameters<typeof reduce>[1] & { type: "failed" }) => run([code], running());

  test("a failure on our side is an error, and retry returns to the inputs", () => {
    for (const code of ["offline", "model_error", "timeout", "nothing_parsed", "bot_check", "unknown"] as const) {
      const state = failed({ type: "failed", code });
      expect(state).toMatchObject({ status: "error", code });
      expect(run([{ type: "retry" }], state).status).toBe("ready");
    }
  });

  test("a scanned PDF sends the visitor back to the form with the file marked", () => {
    const state = failed({ type: "failed", code: "file_no_text" });
    expect(state).toMatchObject({ status: "idle", touched: true });
    expect(state.input.fileProblem).toBe("file_no_text");
    expect(state.input.file?.name).toBe("resume.pdf"); // kept, so its name can be shown
  });

  test("a problem only the server can see is shown at the form until the input changes", () => {
    const state = failed({ type: "failed", code: "resume_too_long" });
    expect(state).toMatchObject({ status: "idle", serverProblem: "resume_too_long" });
    const edited = run([{ type: "job_typed", text: `${JOB}!` }], state);
    expect(edited.status).toBe("ready");
  });

  test("the daily limit: for the site, or for this visitor", () => {
    expect(failed({ type: "failed", code: "limit_site" })).toMatchObject({ status: "limited", scope: "site" });
    expect(failed({ type: "failed", code: "limit_visitor" })).toMatchObject({ status: "limited", scope: "visitor" });
  });

  test("a paused demo", () => {
    expect(failed({ type: "failed", code: "paused" }).status).toBe("paused");
  });
});

describe("no live run can start", () => {
  test("the status check blocks the form before anything is uploaded", () => {
    expect(run([{ type: "availability", value: "limited" }])).toMatchObject({ status: "limited", scope: "site" });
    expect(run([{ type: "availability", value: "paused" }]).status).toBe("paused");
    expect(run([{ type: "availability", value: "open" }])).toBe(INITIAL);
  });

  test("the status check never interrupts a run or a result", () => {
    const going = running();
    expect(run([{ type: "availability", value: "limited" }], going)).toBe(going);
  });

  test("the recorded run can be watched from there, and ends back at the notice", () => {
    const limited = run([{ type: "availability", value: "limited" }]);
    const watching = run([{ type: "started", source: "replay", at: 5 }], limited);
    expect(watching).toMatchObject({ status: "running", source: "replay" });
    const watched = run([{ type: "finished", result: EXAMPLE_RUN.result }], watching);
    expect(watched).toMatchObject({ status: "done", source: "replay" });
    // Not the form: the visitor still cannot run their own resume today.
    expect(run([{ type: "reset" }], watched)).toMatchObject({ status: "limited", scope: "site" });
  });
});

describe("the sentence shown while a run is going", () => {
  const step = (kind: StepKind, extra: Partial<Step> = {}): Step => ({ n: 0, kind, ms: 0, ...extra });
  const plan = (calls: Record<string, number>) => step("plan", { calls });

  test("nothing yet: reading", () => {
    expect(phaseOf([])).toBe("reading");
  });

  test("the recorded run passes through every stage in order", () => {
    // Collect the stage after each step, without repeats.
    const stages: string[] = [];
    EXAMPLE_RUN.steps.forEach((_, index) => {
      const phase = phaseOf(EXAMPLE_RUN.steps.slice(0, index + 1));
      if (stages[stages.length - 1] !== phase) stages.push(phase);
    });
    expect(stages).toEqual(["matching", "rewriting", "checking", "building"]);
  });

  test("once a turn's results are all in, the stage moves on to what comes next", () => {
    const steps = [step("read_resume"), step("read_job"), plan({ search_evidence: 2 })];
    expect(phaseOf(steps)).toBe("matching");
    // One of two results: still matching. Both: the rewrite is next.
    expect(phaseOf([...steps, step("match_found")])).toBe("matching");
    expect(phaseOf([...steps, step("match_found"), step("match_missing")])).toBe("rewriting");
  });

  test("nothing on the resume matched: straight to putting it together", () => {
    const steps = [step("read_job"), plan({ search_evidence: 1 }), step("match_missing")];
    expect(phaseOf(steps)).toBe("building");
  });

  test("every line was kept as written: nothing to check", () => {
    const steps = [plan({ search_evidence: 1 }), step("match_found"), plan({ rewrite_bullet: 1 }), step("kept")];
    expect(phaseOf(steps)).toBe("building");
  });

  test("a failed check leads to a second attempt, and that is said", () => {
    const steps = [
      plan({ search_evidence: 1 }),
      step("match_found"),
      plan({ rewrite_bullet: 1 }),
      step("rewrote"),
      plan({ verify_claim: 1 }),
      step("check_failed"),
    ];
    expect(phaseOf(steps)).toBe("fixing");
    expect(phaseOf([...steps, plan({ rewrite_bullet: 1 })])).toBe("fixing");
    expect(phaseOf([...steps, plan({ rewrite_bullet: 1 }), step("rewrote")])).toBe("checking");
  });

  test("a step kind this version does not know changes nothing", () => {
    const steps = [step("read_job"), plan({ search_evidence: 2 }), step("other" as StepKind)];
    expect(phaseOf(steps)).toBe("matching");
  });
});
