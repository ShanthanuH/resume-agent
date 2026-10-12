# Decisions

Each entry: the decision, the alternative, and why the alternative lost.

## Rung 5: product (2026-10-12)

### Hosting: Vercel for the frontend, Hugging Face Spaces (Docker) for the backend
- **Alternative:** Cloud Run, Render or Fly.io for the backend.
- **Why it lost:** Render's free tier sleeps and takes most of a minute to wake. Cloud Run cold-starts on each idle period unless a paid warm instance is kept. Fly.io has no free tier. Spaces is free, builds the image remotely (no local Docker needed), and only sleeps after 48 hours without traffic. The landing, example and privacy pages are static on Vercel, so an ad visitor's first load never waits on the backend.

### The run streams over a POST response, not EventSource
- **Alternative:** `POST /runs` returns an ID, then `GET /runs/{id}/events` with the browser's EventSource.
- **Why it lost:** that needs the server to hold each run under an ID between two requests. One streamed POST keeps the server stateless, so "we store nothing" is true by construction. The cost is parsing the event stream by hand in `web/lib/api.ts` (about 30 lines).

### The stream polls the session's trace; the agent loop is untouched
- **Alternative:** add a callback to `Session.log` so each step is pushed as it happens.
- **Why it lost:** the spec forbids changing core logic without asking. The agent runs in a worker thread and the stream reads new trace entries every 0.3 s. Steps arrive per batch (all searches at once), so "requirement 3 of 9" style progress is not possible without changing the loop.

### One agent run at a time per server
- **Alternative:** run requests concurrently.
- **Why it lost:** `llm.USAGE` is one process-wide counter, so concurrent runs would mix their token counts and log wrong costs. A semaphore queues runs. Fixing this properly means per-run usage tracking in `llm.py`, which is core code.

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
- **Why it lost:** the parser prompt skips it on purpose and prompts are core logic. The lines above the first parsed line are the header.

### Limits are counted in memory
- **Alternative:** Redis or a database.
- **Why it lost:** one server process, so memory is enough, free, and stores nothing on disk. A restart resets the counts, which only allows a few extra runs. IPs are salted and hashed, with a salt that changes on every start.

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
- **Why it lost:** budget. At about $0.05 a run, a cap of 3 bounds the model bill at roughly $5 a month in the worst case. The example page is now the main path on the landing page, and the limit message links to it. The per-IP limit stays in the code but cannot bind while both are 3.

### Cut for tonight
Dark mode, DOCX upload, the "Questions for you" panel, the Playwright test, analytics events and the "report a false claim" button. `ask_user` answers with nothing, as in the eval.
