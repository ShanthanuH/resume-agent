# Decisions

Each entry: the decision, the alternative, and why the alternative lost.

## Product (2026-10-12)

### Hosting: one Vercel project with two services (Next.js and FastAPI)
- **Alternative:** FastAPI in Docker on Hugging Face Spaces, Cloud Run, Render or Fly.io.
- **Why it lost:** Hugging Face now needs a paid plan for Docker Spaces (found on the first deploy attempt). Cloud Run needs a Google Cloud billing account and a second platform. Render's free tier takes most of a minute to wake. Fly.io has no free tier. Vercel runs FastAPI as a Python function on the free plan, with a 300 s limit against a 60 s run. Both services ship in one deployment on one address, so there is no CORS and no version skew. The cost: a cold start of a few seconds on the first live run after idle, and no Docker image. The landing, example and privacy pages are static, so they never wait on the backend.

### Run counts live in Redis (Upstash); with no Redis, production refuses every run
- **Alternative:** count in memory.
- **Why it lost:** a serverless function loses its memory whenever an idle instance is stopped, so the count would reset and the cap of 3 would leak. The counter uses Redis INCR, which is atomic, over Upstash's HTTPS API with the httpx client already installed (no new dependency). IPs are stored only as salted hashes and expire after two days. If Redis is missing or unreachable the run is refused: a config mistake must not mean unlimited paid model calls. In development the count stays in memory.

### The run streams over a POST response, not EventSource
- **Alternative:** `POST /runs` returns an ID, then `GET /runs/{id}/events` with the browser's EventSource.
- **Why it lost:** that needs the server to hold each run under an ID between two requests. One streamed POST keeps the server stateless, so "we store nothing" is true by construction. The cost is parsing the event stream by hand in `web/lib/api.ts` (about 30 lines).

### The stream polls the session's trace; the agent loop is untouched
- **Alternative:** add a callback to `Session.log` so each step is pushed as it happens.
- **Why it lost:** the agent loop is frozen for the eval, so the API reads from it and does not change it. The agent runs in a worker thread and the stream reads new trace entries every 0.3 s. Steps arrive per batch (all searches at once), so "requirement 3 of 9" style progress is not possible without changing the loop.

### One agent run at a time per server
- **Alternative:** run requests concurrently.
- **Why it lost:** `llm.USAGE` is one process-wide counter, so concurrent runs would mix their token counts and log wrong costs. A semaphore queues runs. Fixing this properly means per-run usage tracking in `llm.py`, which is part of the frozen agent.

### The browser holds the result and sends it back for the PDF
- **Alternative:** keep the session on the server and render from it.
- **Why it lost:** it would mean storing resume content between requests. The trade-off: `/api/pdf` renders whatever text it is sent, so every field is length-limited and HTML is escaped.

### PDF rendered with PyMuPDF's Story, not a headless browser
- **Alternative:** Playwright or WeasyPrint on the server.
- **Why it lost:** PyMuPDF is already a dependency, renders in milliseconds, and adds nothing to the image. A browser adds hundreds of MB and is the usual thing that breaks on deploy. The cost: Story supports only basic CSS, so the template is deliberately simple.

### One page is enforced by rendering, shrinking the font from 10.5 pt to 8 pt
- **Alternative:** trust the character-count estimate in `assemble.py`.
- **Why it lost:** the estimate cannot know how lines wrap. If the resume still does not fit at 8 pt, the real page count is shown to the user, not hidden.

### A4 paper
- **Alternative:** US Letter.
- **Why it lost:** the first users are in India, where A4 is standard. No setting for it yet.

### Contact details are replaced by placeholders before any model call
- **Alternative:** send the resume as is, or cut the whole header before parsing.
- **Why it lost:** sending as is breaks the privacy promise. Cutting the header needs to know where it ends before the resume is parsed. Regex placeholders for email, phone and links are simple and testable. Known limit: the name and any street address are still sent, and the privacy page says so.

### The header (name, contact line) is taken from the resume text in code
- **Alternative:** have the parser return it.
- **Why it lost:** the parser prompt skips it on purpose, and changing that prompt would change the agent the eval measures. The lines above the first parsed line are the header.

### The visitor's IP is read from the right of X-Forwarded-For
- **Alternative:** take the first entry.
- **Why it lost:** a visitor can put anything at the front of that header to dodge the per-IP limit. Proxies append, so counting `TRUSTED_PROXY_HOPS` from the right gives the address our own proxy saw.

### The bot check fails closed
- **Alternative:** skip the check when no Turnstile secret is set.
- **Why it lost:** a missing env var in production would silently open paid model calls to bots. Only `APP_ENV=dev` allows runs without a secret.

### A real run starts with no change accepted; the example starts with all accepted
- **Alternative:** accept everything by default.
- **Why it lost:** the human approval step is the last safeguard, so it should be a real choice. A note by the download button says how many changes are still unaccepted. The example page shows the finished state because nobody is reviewing their own resume there.

### A requirement counts as covered if an accepted bullet or an untouched original line covers it
- **Alternative:** count only rewritten bullets.
- **Why it lost:** a line the writer left alone is the user's own words and is trivially supported. Not counting it would understate the match.

### The example page is a saved real run, imported at build time
- **Alternative:** hand-written sample data.
- **Why it lost:** the page says "real and unedited", so it must be. The same JSON also drives `REPLAY_FILE`, which replays it through the API for free frontend testing.

### Demo, not a public tool: 3 live runs a day for the whole site
- **Alternative:** 100 runs a day with 3 per IP, sized for ad traffic.
- **Why it lost:** budget. At about $0.05 a run, a cap of 3 bounds the model bill at roughly $5 a month in the worst case. The example page is now the main path on the landing page, and the limit message links to it. Each IP address gets 1 run a day, so one visitor cannot use the whole quota.

### Owner bypass: a secret key in a cookie, sent as the x-owner-key header
- **Alternative:** raise the limits while testing, or reset the Redis counts by hand each time.
- **Why it lost:** both are easy to forget and leave the site open or closed by mistake. The owner visits `/owner#key=...` once; the page stores the key in a cookie and the run request sends it as a header. A matching key skips the daily cap and the per-IP limit, but not the bot check. The key is compared in constant time and never logged. It is read from the URL fragment (after `#`), which browsers do not send to the server, so it stays out of request logs; `?key=` also works but does reach those logs. With `OWNER_KEY` unset there is no bypass at all.

### Not built yet
Dark mode, DOCX upload, the "Questions for you" panel, the Playwright test, analytics events and the "report a false claim" button. `ask_user` answers with nothing, as in the eval.
