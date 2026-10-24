// The result's panel says which job the resume was tailored for. The backend
// does not send a job title, so it is read from the top of the job post the
// visitor pasted: most posts start with the title, then the company.
//
// It is a guess, so it is careful: a line that reads like a heading ("About
// the role:") or a sentence is not taken. When in doubt, it says nothing and
// the panel falls back to "This job post".

export type JobHeading = { title: string; company: string | null };

const MAX_TITLE = 70;
const MAX_COMPANY = 60;

/** The non-empty lines of a text, trimmed. */
function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** True if a line could be a title: short, not a heading, not a sentence. */
function looksLikeTitle(line: string, max: number): boolean {
  if (line.length > max) return false;
  if (/[:.?!]$/.test(line)) return false; // "About the role:", or a sentence
  if (/^(about|job description|description|overview|summary|we are|we're)\b/i.test(line)) return false;
  return true;
}

/**
 * The job title and company from the top of a job post, or null.
 * "Backend Engineer, Payments Platform\nNorthwind Pay (fictional company) | Bengaluru"
 * gives { title: "Backend Engineer, Payments Platform", company: "Northwind Pay (fictional company)" }.
 */
export function jobHeading(jobText: string): JobHeading | null {
  const [first, second] = lines(jobText);
  if (!first || !looksLikeTitle(first, MAX_TITLE)) return null;
  // The company line often goes on with a place: "Northwind Pay | Bengaluru".
  const company = second?.split(/\s+[|·•–-]\s+/)[0]?.trim() ?? "";
  return { title: first, company: company && looksLikeTitle(company, MAX_COMPANY) ? company : null };
}

/**
 * The company line as written, with " | " shown as " · ".
 * "Northwind Pay (fictional company) | Bengaluru, hybrid" gives
 * "Northwind Pay (fictional company) · Bengaluru, hybrid".
 */
export function companyLine(jobText: string): string | null {
  const second = lines(jobText)[1];
  if (!second || second.length > 90) return null;
  return second.replace(/\s+\|\s+/g, " · ");
}
