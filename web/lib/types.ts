// The shapes the backend sends. They mirror src/resume_agent/api/payload.py.

export type StepKind = "ok" | "gap" | "bad" | "warn" | "info";

/** One line of the agent trace, already worded for a visitor. */
export type Step = {
  n: number;
  tool: string;
  kind: StepKind;
  title: string;
  detail: string;
  ms: number;
};

export type Link = { label: string; url: string };

/** One position on the resume: the original text, and the bullet proposed for it. */
export type Line = { evidence_id: string; original: string; bullet_id: string | null };

export type Entry = { title: string; organization: string; dates: string; lines: Line[] };

export type Section = { name: string; entries: Entry[] };

/** A rewritten bullet. Every one here has passed the verifier. */
export type Bullet = {
  id: string;
  text: string;
  replaces: string | null;
  source_ids: string[];
  requirement_ids: string[];
  attempts: number;
  rejections: string[]; // what the verifier said about earlier attempts
};

export type Requirement = {
  id: string;
  text: string;
  priority: "must_have" | "nice_to_have";
  bullet_ids: string[]; // rewritten bullets that cover it
  kept_line_ids: string[]; // original lines that already cover it
};

export type Result = {
  header: string[]; // name first, then contact lines
  links: Link[];
  sections: Section[];
  bullets: Bullet[];
  evidence: Record<string, string>; // line ID -> original text
  requirements: Requirement[];
  stats: {
    seconds: number;
    steps: number;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number | null;
  };
};

export type SavedRun = { steps: Step[]; result: Result };
