import { expect, test } from "vitest";
import { EXAMPLE_RUN } from "./example";
import { headerLines, styledPieces } from "./marks";
import { buildDoc } from "./resume";

const bold = (text: string, n = 0) => ({ text, n, bold: true, italic: false, url: null });

test("a mark lands on its own occurrence, as whole words", () => {
  const pieces = styledPieces("cut 60% of 60% delivered", [bold("60%", 1)]);
  expect(pieces).toEqual([
    { text: "cut 60% of ", bold: false, italic: false },
    { text: "60%", bold: true, italic: false },
    { text: " delivered", bold: false, italic: false },
  ]);
  // "live" is not found inside "delivered".
  expect(styledPieces("delivered", [bold("live")])).toEqual([{ text: "delivered", bold: false, italic: false }]);
});

test("a run saved before header lines existed shows organisation, then title", () => {
  const entry = { title: "Software Engineer", organization: "Lakeshore", dates: "2022", lines: [] };
  expect(headerLines(entry).map((h) => [h.left.text, h.right.text])).toEqual([
    ["Lakeshore", "2022"],
    ["Software Engineer", ""],
  ]);
});

test("the saved replay still builds a PDF request, with kinds filled in", () => {
  const doc = buildDoc(EXAMPLE_RUN.result, new Set());
  const experience = doc.sections.find((s) => s.name === "Experience")!;
  expect(experience.entries[0].lines[0].kind).toBe("bullet");
  const skills = doc.sections.find((s) => s.name === "Technical Skills")!;
  expect(skills.entries[0].lines[0].kind).toBe("line");
  expect(doc.header_marks).toEqual([]);
});
