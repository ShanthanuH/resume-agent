// Site-wide settings. The product name lives here only, so renaming is one line.
export const SITE_NAME = "SwooshCV";
// "Built to", not "never": the claim stays a design goal until the eval measures it.
export const SITE_TITLE = "SwooshCV: resume tailoring built to never invent experience";
export const PROMISE =
  "Tailor your resume to any job. Every claim traces back to your original. Built to never invent experience.";

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
// The public address of this site, for link previews.
// Vercel sets VERCEL_PROJECT_PRODUCTION_URL (without "https://") at build time.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const GITHUB_URL = "https://github.com/ShanthanuH/resume-agent";

// Must match the limits in src/resume_agent/api/limits.py. The server checks
// again; these only give a faster, friendlier message.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_RESUME_CHARS = 20_000;
export const MAX_JD_CHARS = 15_000;
export const MIN_CHARS = 200;
