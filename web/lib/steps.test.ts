import { expect, test } from "vitest";
import { EXAMPLE_RUN } from "./example";
import { clock, fileSize, nextResetTime } from "./format";
import { changedCount, gaps } from "./resume";
import { errorSentence, problemSentence, stepSentence } from "./steps";

test("every step of the recorded run has a plain sentence, or is left out on purpose", () => {
  const sentences = EXAMPLE_RUN.steps.map(stepSentence);
  // The four "plan" steps are the run deciding what to do next: not shown.
  expect(sentences.filter((sentence) => sentence === null)).toHaveLength(4);
  for (const sentence of sentences) {
    if (sentence === null) continue;
    expect(sentence).not.toMatch(/\b[EBRU]\d+\b/); // no IDs like E3 or B2
    expect(sentence).not.toMatch(/[{}]/); // no JSON, and no placeholder left unfilled
    expect(sentence).not.toMatch(/gemini|search_evidence|verify_claim|rewrite_bullet/i); // no model or tool names
  }
  expect(sentences[0]).toBe("Read your resume: 13 lines.");
});

test("a step kind from a newer server is skipped, not shown as a blank line", () => {
  expect(stepSentence({ n: 1, kind: "brand_new" as never, ms: 0 })).toBeNull();
});

test("every failure and every field problem has words", () => {
  for (const code of ["offline", "model_error", "timeout", "nothing_parsed", "bot_check", "unknown"] as const) {
    expect(errorSentence(code).length).toBeGreaterThan(10);
  }
  for (const code of ["resume_missing", "job_missing", "file_too_big", "file_not_pdf", "file_no_text"] as const) {
    expect(problemSentence(code).length).toBeGreaterThan(10);
  }
});

test("the summary counts changed lines, less the ones the visitor kept", () => {
  const { result } = EXAMPLE_RUN;
  expect(changedCount(result, new Set())).toBe(2);
  expect(changedCount(result, new Set([result.bullets[0].id]))).toBe(1);
});

test("not on your resume: what the job asks for with nothing to show for it, must-haves first", () => {
  const missing = gaps(EXAMPLE_RUN.result).map((req) => req.text);
  expect(missing).toEqual(["Django", "Kubernetes", "Terraform", "Kafka", "Experience in payments or fintech", "Go"]);
});

test("numbers are shown the way a person says them", () => {
  expect(clock(0)).toBe("0:00");
  expect(clock(63.5)).toBe("1:03"); // a running clock never shows a second that has not passed
  expect(clock(125)).toBe("2:05");
  expect(fileSize(84_212)).toBe("82 KB");
  expect(fileSize(3_400_000)).toBe("3.2 MB");
});

test("runs open again at the next UTC midnight, said in the visitor's own time", () => {
  const evening = new Date(Date.UTC(2026, 9, 13, 20, 15)); // 13 Oct, 20:15 UTC
  const expected = new Date(Date.UTC(2026, 9, 14)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  expect(nextResetTime(evening)).toBe(expected);
  // The last day of a month rolls over to the first of the next.
  const monthEnd = new Date(Date.UTC(2026, 9, 31, 23, 59));
  expect(nextResetTime(monthEnd)).toBe(
    new Date(Date.UTC(2026, 10, 1)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  );
});
