import { describe, expect, it } from "vitest";
import { EXAMPLE_RUN } from "./example";
import { fiveSteps, progressOf } from "./five-steps";
import { companyLine, jobHeading } from "./job-heading";
import type { Step } from "./types";

const step = (kind: Step["kind"], extra: Partial<Step> = {}): Step => ({ n: 0, kind, ms: 0, ...extra });

describe("fiveSteps", () => {
  it("starts at nothing done", () => {
    expect(fiveSteps([])).toEqual({ done: 0, resumeLines: null, jobAsks: null });
  });

  it("finishes the two reading steps with their counts", () => {
    expect(fiveSteps([step("read_resume", { count: 13 })])).toMatchObject({ done: 1, resumeLines: 13 });
    const both = fiveSteps([step("read_resume", { count: 13 }), step("read_job", { count: 14 })]);
    expect(both).toEqual({ done: 2, resumeLines: 13, jobAsks: 14 });
  });

  it("moves on to rewriting, then building", () => {
    const read = [step("read_resume", { count: 1 }), step("read_job", { count: 1 })];
    const rewriting = [...read, step("plan", { calls: { rewrite_bullet: 1 } })];
    expect(fiveSteps(rewriting).done).toBe(3);
    const building = [...rewriting, step("rewrote"), step("plan", { calls: { assemble_resume: 1 } })];
    expect(fiveSteps(building).done).toBe(4);
  });

  it("never goes back as the recorded run plays", () => {
    let last = 0;
    for (let i = 1; i <= EXAMPLE_RUN.steps.length; i++) {
      const { done } = fiveSteps(EXAMPLE_RUN.steps.slice(0, i));
      expect(done).toBeGreaterThanOrEqual(last);
      last = done;
    }
    expect(last).toBe(4);
  });
});

describe("progressOf", () => {
  it("moves inside a step but stays below the next fifth", () => {
    expect(progressOf(2, 0)).toBeCloseTo(0.4);
    expect(progressOf(2, 30)).toBeGreaterThan(0.4);
    expect(progressOf(2, 1000)).toBeLessThan(0.6);
  });

  it("never reaches the end", () => {
    expect(progressOf(4, 10_000)).toBeLessThan(1);
  });
});

describe("jobHeading", () => {
  it("reads the title and company of the recorded job post", () => {
    expect(jobHeading(EXAMPLE_RUN.jd_text)).toEqual({
      title: "Backend Engineer, Payments Platform",
      company: "Northwind Pay (fictional company)",
    });
    expect(companyLine(EXAMPLE_RUN.jd_text)).toBe("Northwind Pay (fictional company) · Bengaluru, hybrid");
  });

  it("gives up on a post that starts with a heading or a sentence", () => {
    expect(jobHeading("About the role:\nWe build payments.")).toBeNull();
    expect(jobHeading("We are hiring a backend engineer to join our team.")).toBeNull();
    expect(jobHeading("")).toBeNull();
  });
});
