import { API_URL } from "./config";
import type { Result, Step } from "./types";

type Handlers = {
  onStatus: (message: string) => void;
  onStep: (step: Step) => void;
  onDone: (result: Result) => void;
  // limit is true when the daily demo limit stopped the run.
  onFailed: (message: string, limit?: boolean) => void;
};

const OFFLINE = "Could not reach the server. Check your connection and try again.";

/**
 * Start a run and call the handlers as events arrive.
 *
 * The browser's EventSource can only send GET requests, and a resume does not
 * belong in a URL. So this sends a POST with fetch and reads the event stream
 * by hand. The format is simple: blocks separated by a blank line, each with an
 * "event:" line and a "data:" line.
 */
export async function startRun(form: FormData, handlers: Handlers, signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/run`, { method: "POST", body: form, signal });
  } catch {
    if (!signal.aborted) handlers.onFailed(OFFLINE);
    return;
  }
  if (!response.ok || !response.body) {
    // Validation and limit errors come back as plain JSON with a message.
    const body = await response.json().catch(() => null);
    // 429 is the HTTP status for "too many requests": the demo limit.
    handlers.onFailed(body?.message ?? "Something went wrong. Please try again.", response.status === 429);
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
        if (event === "status") handlers.onStatus(payload.message);
        if (event === "step") handlers.onStep(payload);
        if (event === "done") {
          finished = true;
          handlers.onDone(payload);
        }
        if (event === "failed") {
          finished = true;
          handlers.onFailed(payload.message);
        }
      }
    }
  } catch {
    if (signal.aborted) return;
  }
  // The stream closed with no final event: the connection dropped mid-run.
  if (!finished && !signal.aborted) handlers.onFailed(OFFLINE);
}

/** Render the reviewed resume. Returns the PDF and how many pages it came to. */
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
