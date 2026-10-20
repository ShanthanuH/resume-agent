// Everything that talks to the backend: start a run, ask if runs are open,
// make a PDF.

import { API_URL } from "./config";
import type { RunHandlers } from "./replay";
import type { Availability, ErrorCode } from "./types";

export const OWNER_COOKIE = "owner_key";

/** True if this browser holds an owner key. See /owner. */
export function hasOwnerKey(): boolean {
  return document.cookie.includes(`${OWNER_COOKIE}=`);
}

/** The owner's key as a request header, if this browser has it. */
function ownerHeaders(): Record<string, string> {
  // document.cookie is one string: "name=value; other=value".
  const match = document.cookie.match(new RegExp(`(?:^|; )${OWNER_COOKIE}=([^;]+)`));
  return match ? { "x-owner-key": decodeURIComponent(match[1]) } : {};
}

// Every code the backend can send. Anything else becomes "unknown", so a new
// code on the server can never put a blank message on the screen.
const KNOWN: ErrorCode[] = [
  "file_too_big", "file_not_pdf", "file_no_text", "file_unreadable",
  "resume_too_short", "resume_too_long", "job_too_short", "job_too_long",
  "bot_check", "limit_site", "limit_visitor", "paused",
  "timeout", "busy", "nothing_parsed", "model_error",
];

function toCode(value: unknown): ErrorCode {
  return KNOWN.includes(value as ErrorCode) ? (value as ErrorCode) : "unknown";
}

/**
 * Start a live run and call the handlers as events arrive.
 *
 * The browser's EventSource can only send GET requests, and a resume does not
 * belong in a URL. So this sends a POST with fetch and reads the event stream
 * by hand. The format is simple: blocks separated by a blank line, each with an
 * "event:" line and a "data:" line.
 */
export async function startRun(form: FormData, handlers: RunHandlers, signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/run`, {
      method: "POST",
      body: form,
      signal,
      headers: ownerHeaders(),
    });
  } catch {
    if (!signal.aborted) handlers.onFailed("offline");
    return;
  }
  if (!response.ok || !response.body) {
    // Input, limit and pause errors come back as plain JSON with a code.
    const body = await response.json().catch(() => null);
    handlers.onFailed(toCode(body?.code));
    return;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      // A network chunk can end mid-event, so only complete blocks are handled.
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? ""; // the last piece is incomplete: keep it for later
      for (const block of blocks) {
        const event = block.match(/^event: (.+)$/m)?.[1];
        const data = block.match(/^data: (.+)$/m)?.[1];
        if (!event || !data) continue; // a keep-alive comment
        const payload = JSON.parse(data);
        if (event === "status" && payload.code === "queued") handlers.onQueued();
        if (event === "step") handlers.onStep(payload);
        if (event === "done") {
          finished = true;
          handlers.onDone(payload);
        }
        if (event === "failed") {
          finished = true;
          handlers.onFailed(toCode(payload.code));
        }
      }
    }
  } catch {
    if (signal.aborted) return;
  }
  // The stream closed with no final event: the connection dropped mid-run.
  if (!finished && !signal.aborted) handlers.onFailed("offline");
}

/**
 * Ask whether a live run could start right now. Returns "open" when the
 * question itself fails: the run request checks again, so guessing "open"
 * costs nothing, while guessing "closed" would lock a visitor out for no reason.
 */
export async function fetchAvailability(signal: AbortSignal): Promise<Availability> {
  try {
    const response = await fetch(`${API_URL}/api/status`, { signal });
    const body = await response.json();
    return body.runs === "limited" || body.runs === "paused" ? body.runs : "open";
  } catch {
    return "open";
  }
}

/** Render a resume. Returns the PDF and how many pages it came to. */
export async function fetchPdf(doc: unknown): Promise<{ blob: Blob; pages: number }> {
  const response = await fetch(`${API_URL}/api/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!response.ok) throw new Error("PDF render failed");
  return {
    blob: await response.blob(),
    pages: Number(response.headers.get("X-Page-Count") ?? "1"),
  };
}

/** Hand a file to the browser's download flow. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor); // Firefox only clicks anchors that are in the page
  anchor.click();
  anchor.remove();
  // Give the download a moment to start before freeing the memory.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
