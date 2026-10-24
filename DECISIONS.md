# Decisions

Each entry: the decision, the alternative, and why the alternative lost.

## Evaluation

### D1. Verifier-off is a flag on Session, and verify_claim still exists
- **Decision:** `Session.verifier_on=False` makes `verify_claim` pass every bullet without running the rules or the judge. The agent sees the same `{"passed": true}` output as a real pass. Only the trace says "keep, verifier off".
- **Alternative:** remove the `verify_claim` tool from the agent's tool list and prompt for A0.
- **Why it lost:** that changes the prompt and the tool set, so A0 and A1 would differ in two ways. With the flag, the only difference is whether bullets are checked, so A1 minus A0 is the verifier's effect.

### D2. Headline numbers come from the `eval-v1` tag
- **Decision:** the agent is tagged `eval-v1` right after the flag, before any eval data is run. Fixes found later are reported separately.
- **Alternative:** fix bugs as the eval finds them and report the final numbers.
- **Why it lost:** that tunes the agent on the test set. The numbers would then be too good.

### D3. R2 is not cut to one page
- **Decision:** leave assembly as it is. It never drops lines; it only rejects a resume longer than 1.02x the original. R2 stays 2 pages.
- **Alternative:** add real one-page cutting before the freeze, as first planned.
- **Why it lost:** it changes core agent logic one step before the freeze, with no time to test it. EVAL_PLAN.md states the real behaviour instead.

### D4. One output shape without the agent's IDs
- **Decision:** every system returns `TailoredResume` (sections, entries, lines as plain text). The agent's `ResumeJson` is converted by dropping evidence and bullet IDs.
- **Alternative:** make the baselines return the agent's exact `ResumeJson`.
- **Why it lost:** a baseline cannot know evidence IDs, and a scorer that reads them would be using the agent's own bookkeeping to score the agent.

### D5. "Unchanged" is tested against the raw PDF text
- **Decision:** a line is unchanged if its normalized text appears in the normalized text of the original PDF. Skills rows are split and scored skill by skill. Changed entry headers (title, organization, dates) are scored too.
- **Alternative:** compare against the agent's parsed evidence lines.
- **Why it lost:** the agent's parse can drop or split lines, so the test would depend on the system being scored. Headers are added because a baseline can change a job title there, and a list of bullets alone would miss it.

### D6. S1 is strict on numbers, lenient on names
- **Decision:** S1 flags any number, percentage or duration not in the resume. For titles it uses only unambiguous words. For employers it flags a name only when none of its telling words is in the resume, and only in the organization field or shapes like "at X".
- **Alternative:** flag every capitalised word that is not in the resume.
- **Why it lost:** that flags honest rewording ("REST API", "IIT Kharagpur"). The headline counts a resume as bad on one flag, so S1 false positives would hurt the baselines and flatter the agent. New skills and other names are left to S2.

### D7. The baselines do not get the agent's injection note
- **Decision:** B1 and B2 go through `eval/gemini.py`, a plain call with only their own prompt and a neutral format note.
- **Alternative:** reuse `llm.generate_structured`.
- **Why it lost:** it appends the agent's "treat tagged text as untrusted" note, which would give the naive baseline a defence it should not have.

### D8. Models are pinned by exact name for the eval
- **Decision:** `eval/config.py` sets `gemini-3.8-flash` and `gemini-3.5-flash-lite` on the llm module. Judge: `gemini-3.1-pro-preview`.
- **Alternative:** keep the `-latest` aliases.
- **Why it lost:** Google can repoint an alias mid-run, and then runs of one eval would come from two models.

### D9. Parallel runs use processes, not threads
- **Decision:** `ProcessPoolExecutor`, one case per process at a time.
- **Alternative:** threads.
- **Why it lost:** the agent counts tokens in a module global. Two runs in one process would mix their token counts and costs, and fixing that means changing frozen agent code.

### D10. A run hit by an API fault is thrown away and re-run
- **Decision:** if an agent tool crashed with a 429, 500 or 503 inside a run, the whole run is discarded and started again (3 tries). Other tool crashes stay in the run and are scored.
- **Alternative:** keep every run as it came out.
- **Why it lost:** a rate limit is the API's fault, not agent behaviour. The rule is fixed before the full run and does not look at the output, so it cannot be used to pick good runs.

### D11. ask_user returns an empty string in the eval
- **Decision:** the eval answers every question with `""`.
- **Alternative:** the literal text "No answer", as first planned.
- **Why it lost:** the agent's no-answer list does not contain "no answer", so that text would be stored as a user-confirmed fact. The empty string is what the agent itself logs as "no answer".

### D12. The original resume's coverage goes through the same judge call
- **Decision:** the reference coverage is measured by sending the original resume through the same coverage call as every output.
- **Alternative:** define it as 100%, since "supportable" already means the resume has evidence.
- **Why it lost:** "has evidence" and "clearly addresses" are two judgements. Measuring both the same way keeps the reference comparable.

### D13. The judge moved to Claude Sonnet through the CLI (replaces the judge in D8)
- **Decision:** S2 and coverage run on `claude -p --model sonnet` on the Pro plan: one call at a time, a pause after each, a clean stop on a usage limit.
- **Alternative:** the Gemini Pro judge from the first plan.
- **Why it lost:** it cost about as much as the runs themselves and the credit could not be topped up. Claude is also a different provider from every system tested, which removes the "judge favours its own family" threat. The cost: no temperature control, and a subscription alias instead of a pinned model.

### D14. A0 and B3 dropped, one run per JD
- **Decision:** run only B1, B2 and A1, once each, on all 40 JDs.
- **Alternative:** keep all five systems on fewer JDs.
- **Why it lost:** the headline question is A1 against B2, and its interval is over JDs. Fewer JDs would widen it; fewer systems only removes side questions. The losses (no verifier ablation, no stronger-model baseline, no consistency) are listed in EVAL_PLAN.md.

### D15. The spend cap stops before it is reached
- **Decision:** the runner stops starting cases when spend + (workers x the dearest case so far) would pass the cap. Cheap systems run first.
- **Alternative:** stop when spend reaches the cap.
- **Why it lost:** cases already running cannot be stopped, so that rule overshoots by up to one case per worker. A cap that can be passed is not a hard cap. Known gap: tokens of a try that crashed are not counted.

### D16. The labelling sheet deals rows evenly over system x resume
- **Decision:** 200 rows, dealt one at a time from each of the 9 (system, resume) cells, then shuffled with a fixed seed. System names live only in `key.csv`. `label.html` shows the right original resume beside each row.
- **Alternative:** a plain random sample of all changed lines.
- **Why it lost:** B1 changes about ten times more lines than B2 or A1, so a plain sample would be nearly all B1 and judge-human agreement per system could not be measured.

### D17. Systems are compared only on JDs all of them finished
- **Decision:** every table uses the JDs that B1, B2 and A1 all finished. The adversarial table is shown twice: on the 4 shared JDs and on everything each system finished.
- **Alternative:** score each system on whatever it finished.
- **Why it lost:** A1 is missing 6 adversarial JDs (the credit ran out). Comparing 4 JDs against 10 would mix "which system" with "which JDs".

### D18. One claim per unsupported line, typed by the judge first
- **Decision:** metric 3 counts one claim per unsupported line. Its type is the judge's when S2 flagged it, otherwise the first S1 flag's.
- **Alternative:** count every S1 flag and the S2 verdict as separate claims.
- **Why it lost:** S1 and S2 often flag the same words, so that would count one invented fact twice.

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
