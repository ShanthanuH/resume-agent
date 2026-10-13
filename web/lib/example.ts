// The recorded run: one real run on a made-up resume, saved by
// src/resume_agent/api/make_example.py. Importing the file puts it in the page
// at build time, so playing it back needs no server and no model.
import saved from "@/public/example.json";
import type { Result, SavedRun } from "./types";

// The JSON's types are wider than ours (a step's kind is "string" to
// TypeScript), so it is narrowed here once. tests/test_api.py checks the file.
export const EXAMPLE_RUN = saved as unknown as SavedRun;

/**
 * A small part of a result: one entry of one section, and only some of its
 * lines. The home page shows this instead of the whole resume, so the demo
 * fits on a phone. Everything else about the result stays as it was.
 */
export function excerpt(result: Result, section: string, entry: number, lines: [number, number]): Result {
  const found = result.sections.find((s) => s.name === section);
  const picked = found?.entries[entry];
  if (!found || !picked) return result; // the recording changed shape: show it whole
  const kept = { ...picked, lines: picked.lines.slice(lines[0], lines[1]) };
  // No header: the excerpt starts at the job, not at the person's name.
  return { ...result, header: [], sections: [{ ...found, entries: [kept] }] };
}
