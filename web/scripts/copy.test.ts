import { expect, test } from "vitest";
import { buildCopy, checkCopy, generate } from "./copy.mjs";

/** One well-formed entry, as it would be written in copy.yaml. */
const entry = (key: string, text: string, max = 50, extra = "") =>
  `${key}:\n  where: Home page, top\n  max: ${max}\n${extra}  text: >-\n    ${text}\n`;

const problems = (yaml: string, used?: Map<string, string>) => checkCopy(yaml, used).errors;

test("a good file has no problems, and its texts come out by key", () => {
  const { errors, texts } = checkCopy(entry("hero_title", "Tailor your resume to the job."));
  expect(errors).toEqual([]);
  expect(texts).toEqual({ hero_title: "Tailor your resume to the job." });
});

test("a text over its max is named, with both numbers", () => {
  const text = "x".repeat(61);
  expect(problems(entry("hero_title", text))).toEqual(["copy.yaml: hero_title is 61 characters, max is 50"]);
});

test("a long text written over several lines is measured as the one line it becomes", () => {
  // ">-" joins the lines with single spaces: 11 + 1 + 11 = 23 characters.
  const yaml = "hero_title:\n  where: Home page\n  max: 23\n  text: >-\n    hello there\n    hello there\n";
  expect(problems(yaml)).toEqual([]);
});

test("a key the site uses but the file lacks is named, with where it is used", () => {
  const used = new Map([
    ["hero_title", "app/page.tsx"],
    ["hero_lead", "app/page.tsx"],
  ]);
  expect(problems(entry("hero_title", "Hello"), used)).toEqual([
    "copy.yaml: hero_lead is missing. The site uses it in app/page.tsx",
  ]);
});

test("a key nothing uses is called out, so the file does not collect dead text", () => {
  const used = new Map([["hero_title", "app/page.tsx"]]);
  const yaml = entry("hero_title", "Hello") + entry("old_idea", "Bye");
  expect(problems(yaml, used)).toEqual(["copy.yaml: old_idea is not used anywhere on the site. Remove it"]);
});

test("missing where, max or text are each said plainly", () => {
  expect(problems("hero_title:\n  max: 10\n  text: >-\n    Hi\n")).toEqual(["copy.yaml: hero_title has no where"]);
  expect(problems("hero_title:\n  where: Top\n  text: >-\n    Hi\n")).toEqual([
    "copy.yaml: hero_title has no max (a whole number of characters)",
  ]);
  expect(problems("hero_title:\n  where: Top\n  max: 10\n")).toEqual(["copy.yaml: hero_title has no text"]);
  expect(problems("hero_title: Just the text\n")).toEqual([
    "copy.yaml: hero_title needs three lines under it: where, max and text",
  ]);
});

test("a {name} the site fills in must stay, and an unknown one is caught", () => {
  const keep = "  keep: count\n";
  expect(problems(entry("summary", "{count} lines changed.", 50, keep))).toEqual([]);
  expect(problems(entry("summary", "Some lines changed.", 50, keep))).toEqual([
    "copy.yaml: summary must keep {count} in its text",
  ]);
  expect(problems(entry("summary", "{cout} lines changed.", 50, keep))).toEqual([
    "copy.yaml: summary must keep {count} in its text",
    "copy.yaml: summary uses {cout}, which the site does not fill in",
  ]);
});

test("the banned words are refused", () => {
  expect(problems(entry("hero_title", "A seamless way to elevate your resume"))).toEqual([
    'copy.yaml: hero_title uses the banned word "seamless"',
    'copy.yaml: hero_title uses the banned word "elevate"',
  ]);
});

test("the home page has a word limit, and text behind a toggle does not count", () => {
  const words = (count: number) => Array(count).fill("word").join(" ");
  const yaml =
    entry("home_title", words(100), 2000) + entry("nav_try", words(51), 2000) + entry("home_more_detail", words(500), 5000);
  expect(problems(yaml)).toEqual([
    "copy.yaml: the home page has 151 words, max is 150 (the FAQ and text behind a toggle are not counted)",
  ]);
});

test("a file that is not valid YAML says which line", () => {
  const [first] = problems("hero_title:\n  where: Top\n   max: 10\n");
  expect(first).toMatch(/^copy\.yaml: line \d+ cannot be read\./);
});

test("the same key twice is an error, not a silent overwrite", () => {
  const [first] = problems(entry("hero_title", "One") + entry("hero_title", "Two"));
  expect(first).toMatch(/^copy\.yaml: line \d+ cannot be read\. Map keys must be unique/);
});

test("the generated module is plain TypeScript with one line per key", () => {
  expect(generate({ hero_title: 'Say "hi"' })).toContain('  hero_title: "Say \\"hi\\"",');
});

test("the real copy.yaml passes, against the keys the real code uses", () => {
  expect(buildCopy({ checkOnly: true })).toEqual([]);
});
