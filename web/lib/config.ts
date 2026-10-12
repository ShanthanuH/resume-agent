// Site-wide settings. The product name lives here only, so renaming is one line.
export const SITE_NAME = "Traceline";
export const PROMISE =
  "Tailor your resume to any job. Every claim traces back to your original. Nothing invented.";

// NEXT_PUBLIC_ variables are baked into the browser bundle at build time.
// Where the FastAPI backend lives. The default is the local dev server.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
// Cloudflare Turnstile site key. Empty turns the widget off (local dev only:
// the backend still refuses runs in production without a valid token).
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
// The public address of this site, for link previews.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const GITHUB_URL = "https://github.com/ShanthanuH/resume-agent";

// Must match the limits in src/resume_agent/api/limits.py. The server checks
// again; these only give a faster, friendlier message.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_RESUME_CHARS = 20_000;
export const MAX_JD_CHARS = 15_000;
export const MIN_CHARS = 200;
