// The shapes the backend sends. They mirror src/resume_agent/api/payload.py.

/**
 * What one step of a run was. The backend sends the kind and a few facts;
 * the words shown for it come from content/copy.yaml (see lib/steps.ts).
 */
export type StepKind =
  | "read_resume" // the resume was split into lines
  | "read_job" // the job post was split into the things it asks for
  | "plan" // the run decided what to do next (never shown to the visitor)
  | "match_found" // a resume line shows something the job asks for
  | "match_missing" // nothing on the resume shows it: it is left out
  | "rewrote" // a line was rewritten
  | "kept" // a line already fits and stays as written
  | "rewrite_empty" // no rewrite came back: the line stays
  | "check_passed" // a rewrite says nothing the original does not
  | "check_failed" // a rewrite said more than the original: it is redone
  | "dropped" // a rewrite was given up: the original stays
  | "asked" // the run has a question for the visitor
  | "assembled" // the resume was put together
  | "assembled_fallback" // out of time: put together from what passed
  | "assemble_retry" // putting it together failed a check, trying again
  | "refused" // a rule in the code blocked a step
  | "tool_error" // a step failed and is tried again
  | "other"; // something this version does not know: shown as nothing

/** One step of a run. Which of the optional facts are set depends on the kind. */
export type Step = {
  n: number; // 1, 2, 3, ... in the order things happened
  kind: StepKind;
  ms: number; // how long this step took
  at?: number; // when it reached the browser, in ms from the start of the run
  count?: number; // read_*: lines or requirements found. match_found: lines that show it
  requirement?: string; // match_*: the thing the job asks for, in its own words
  before?: string; // rewrote, kept: the line as the visitor wrote it
  after?: string; // rewrote: the new line
  question?: string; // asked
  calls?: Record<string, number>; // plan: what comes next, as tool name -> how many
};

export type Link = { label: string; url: string };

/** Bold, italic or a link on part of a line: the n-th time `text` appears in it. */
export type Mark = { text: string; n: number; bold: boolean; italic: boolean; url: string | null };

/** A piece of text as written, with its bold, italic and linked words. */
export type Styled = { text: string; marks: Mark[] };

/** One line of an entry header as written: left text, and the right-hand column. */
export type HeaderLine = { left: Styled; right: Styled };

/**
 * How a line sits on the page: a bulleted line, a line on its own (a skills
 * row), one sentence of a paragraph (the summary), or a line kept as written.
 */
export type LineKind = "bullet" | "line" | "sentence" | "fixed";

/**
 * One position on the resume: the original text, and the rewrite proposed for it.
 * kind, join and marks are missing from runs saved before they existed.
 */
export type Line = {
  evidence_id: string;
  original: string;
  bullet_id: string | null;
  kind?: LineKind;
  join?: boolean; // continues the paragraph of the line before it
  marks?: Mark[]; // bold, italic and links in the original text
};

export type Entry = {
  title: string;
  organization: string;
  dates: string;
  location?: string;
  header_lines?: HeaderLine[]; // the header exactly as printed, one item per line
  lines: Line[];
};

export type Section = { name: string; kind?: string; entries: Entry[] };

/** A rewritten line. Every one here passed the check against its source lines. */
export type Bullet = {
  id: string;
  text: string;
  replaces: string | null; // the resume line it takes the place of
  source_ids: string[]; // the lines it was written from
  requirement_ids: string[]; // what the job asks for that it shows
};

export type Requirement = {
  id: string;
  text: string;
  priority: "must_have" | "nice_to_have";
  bullet_ids: string[]; // rewritten lines that show it
  kept_line_ids: string[]; // original lines that already show it
};

export type Result = {
  header: string[]; // name first, then contact lines
  header_marks?: Mark[][]; // the links of each header line, by position
  links: Link[];
  sections: Section[];
  bullets: Bullet[];
  evidence: Record<string, string>; // line ID -> original text
  requirements: Requirement[];
  questions: string[]; // what the run wanted to ask the visitor
  stats: {
    seconds: number;
    steps: number;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number | null;
  };
};

/** A whole run as saved in public/example.json: what the replay plays back. */
export type SavedRun = { jd_text: string; steps: Step[]; result: Result };

/** Why a run did not start or did not finish. The words are in copy.yaml. */
export type ErrorCode =
  | "file_too_big"
  | "file_not_pdf"
  | "file_no_text" // a scanned PDF: pictures of text, no text
  | "file_unreadable"
  | "resume_too_short"
  | "resume_too_long"
  | "job_too_short"
  | "job_too_long"
  | "bot_check"
  | "limit_site" // the day's free runs are gone for everyone
  | "limit_visitor" // this visitor has had today's run
  | "paused" // live runs are switched off, or the model account is out
  | "timeout"
  | "nothing_parsed"
  | "model_error"
  | "offline" // the request never reached the server, or the stream broke
  | "unknown";

/** What /api/status answers: can a live run start right now? */
export type Availability = "open" | "limited" | "paused";
