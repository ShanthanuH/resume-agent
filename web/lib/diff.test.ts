import { expect, test } from "vitest";
import { diffWords } from "./diff";
import { EXAMPLE_RUN } from "./example";

/** The highlighted phrases of a rewrite. */
const changed = (before: string, after: string) =>
  diffWords(before, after)
    .filter((piece) => piece.changed)
    .map((piece) => piece.text);

test("an unchanged line has no highlight", () => {
  expect(diffWords("Built an API in Python", "Built an API in Python")).toEqual([
    { text: "Built an API in Python", changed: false },
  ]);
});

test("replaced words are highlighted and the rest is not", () => {
  const pieces = diffWords("Added unit tests with pytest", "Wrote automated unit tests with pytest");
  expect(pieces).toEqual([
    { text: "Wrote automated", changed: true }, // neighbours are joined into one highlight
    { text: "unit tests with pytest", changed: false },
  ]);
});

test("the pieces put back together are the rewrite, word for word", () => {
  for (const bullet of EXAMPLE_RUN.result.bullets) {
    const original = EXAMPLE_RUN.result.evidence[bullet.replaces ?? ""];
    const joined = diffWords(original, bullet.text)
      .map((piece) => piece.text)
      .join(" ");
    expect(joined).toBe(bullet.text);
  }
});

test("a comma or a capital letter alone is not a change", () => {
  expect(changed("added Redis caching and tests", "Added Redis caching, and tests")).toEqual([]);
});

test("a changed number is always a change", () => {
  expect(changed("raised coverage to 80%", "raised coverage to 90%")).toEqual(["90%"]);
  expect(changed("a team of 5 engineers", "a team of 50 engineers")).toEqual(["50"]);
  expect(changed("coverage of 80", "coverage of 80%")).toEqual(["80%"]); // the sign is part of the number
});

test("a phrase that only moved is highlighted too", () => {
  // Moving words can change what a sentence claims, so it should draw the eye.
  const marks = changed(
    "Cut response time to 150 ms by adding Redis caching",
    "Added Redis caching, cutting response time to 150 ms",
  );
  expect(marks).toEqual(["Added Redis caching, cutting"]);
});

test("the recorded run's first rewrite is highlighted where it differs", () => {
  const bullet = EXAMPLE_RUN.result.bullets[0];
  const original = EXAMPLE_RUN.result.evidence[bullet.replaces ?? ""];
  expect(changed(original, bullet.text)).toEqual(["Tuned slow PostgreSQL queries and added Redis caching, cutting"]);
});

test("empty lines do not break it", () => {
  expect(diffWords("", "")).toEqual([]);
  expect(diffWords("", "All new")).toEqual([{ text: "All new", changed: true }]);
});
