// Site-wide settings that are not words. Every visible word is in
// content/copy.yaml; this file holds addresses, switches and limits.

// NEXT_PUBLIC_ variables are baked into the browser bundle at build time.
// Where the FastAPI backend lives. On Vercel it is served from this same
// address under /api, so the URL is empty there. In local development it is a
// separate server on port 8000.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000");

// Cloudflare Turnstile site key. Empty turns the widget off (local dev only:
// the backend still refuses runs in production without a valid token).
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// Replay-only mode: the "Tailor my resume" button plays the recorded run and
// never calls the backend. No model, no bot check, no secrets. It is on for
// every Vercel preview deployment, and locally with NEXT_PUBLIC_REPLAY=1.
// Production builds have it off, so the same code does live runs there.
export const REPLAY_ONLY =
  process.env.NEXT_PUBLIC_REPLAY === "1" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";

// The public address of this site, for link previews.
// Vercel sets VERCEL_PROJECT_PRODUCTION_URL (without "https://") at build time.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const GITHUB_URL = "https://github.com/ShanthanuH/resume-agent";
// Where the evaluation lives. The landing page links here from "Does it work?".
export const EVAL_URL = `${GITHUB_URL}/tree/main/eval`;

// Must match the limits in src/resume_agent/api/limits.py. The server checks
// again; these only give a faster, friendlier message.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_RESUME_CHARS = 20_000;
export const MAX_JD_CHARS = 15_000;
export const MIN_CHARS = 200;
