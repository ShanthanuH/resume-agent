# Design notes: the redesign

One line per design decision. Each is "what, because why". Every word on the
site lives in `web/content/copy.yaml`.

## How to look at it

```bash
cd web
npm install
npx playwright install chromium   # once: the browser the two scripts below drive
NEXT_PUBLIC_REPLAY=1 npm run build && NEXT_PUBLIC_REPLAY=1 npm run start -- -p 3100
npm run e2e        # walks the site in a browser: 14 checks
npm run screens    # retakes every picture in docs/screens/
npm test           # state machine, word diff, replay, copy check
npm run copy       # checks copy.yaml and says what is wrong in plain words
```

Replay mode needs no backend, no model and no secrets. Every state of the flow
has its own address on a replay build: open `/states`.

## 1. Replay mode and the fixture

- The fixture is the saved run in `web/public/example.json`, re-encoded, with no model call: it already held every step and each step's latency, and the latencies add up to the run's 63.5 s.
- The saved run has only 2 changed lines: it is the real result, and a real small number beats an invented big one.
- Each step now carries `at`, the moment it reached the browser: steps of one model call arrive together, so the replay moves in the same bursts as a live run.
- The replay is played in the browser, not by the server: it then works with the backend asleep, paused or out of runs, which is exactly when it is needed.
- The server's own `REPLAY_FILE` replay is kept: it tests the real upload, bot check and limits for free.
- A live run and the replay call the same four handlers and feed the same state machine, so they cannot look different.
- The flow replay plays at real speed with a "Skip to the result" button; 64 seconds is honest but nobody should be made to sit through it.
- The home page demo plays the same recording 16 times faster and says so ("Real time 1:04. Shown 16x faster."): a visitor has 5 seconds, not 64.
- The home page demo starts when it scrolls into view, 0.4 s later: on a phone it sits below the headline and would otherwise play to nobody.
- The home page demo shows three lines of the resume, not all of it: it has to fit a phone with room for the original line to slide in.
- Vercel preview deployments are replay-only by code (`VERCEL_ENV=preview`), in the frontend and again in the API: no flag to forget, and a preview can never spend a real run.
- `/states` lists every state of the flow, on replay builds only (a 404 in production): it is how limit, pause and error screens can be reviewed without causing them.

## 2. copy.yaml and its check

- `copy.yaml` is turned into a typed module (`lib/copy.gen.ts`, not in git) by `scripts/copy.mjs`: plain files, no bundler plug-in, and a mistyped key is also a TypeScript error.
- The check runs from `next.config.ts`, so it runs however the build is started, including on Vercel.
- In dev the file is watched, so a changed word shows in the browser without a restart.
- The check finds the keys the code uses by reading the code for `copy.<key>`: that is how it can say "missing" and "not used anywhere" in plain words.
- An unused key is an error, not a warning: the file should hold only what a visitor can read.
- Added one optional field, `keep`, for texts with a blank the site fills in (`{count}`): the check then catches a deleted or misspelled blank.
- The seven banned words fail the check.
- The home page word limit (150) is part of the check: keys starting `nav_`, `footer_`, `home_`; `home_more_*` (behind a toggle) and the FAQ are not counted.
- A lint rule (`react/jsx-no-literals`) fails when text is typed into a component; the check also catches text typed into `aria-label`, `placeholder`, `alt` and `title`.
- The API now sends codes, not sentences (`file_no_text`, `limit_site`, a step's `kind`): otherwise half the visible text would live in Python.
- Not in copy.yaml: the units "KB" and "MB", the file tag "PDF", clock formats, and the example resume itself. They are symbols and data, not copy.

## 3. The run flow and its states

- One reducer (`lib/run-machine.ts`) holds the whole flow: idle, ready, running, done, error, limited, paused. It is pure; the hook `useRun` does the side effects.
- The progress element is five bars, one per stage, with a slow light passing through the current one: a stage is something we know, a percentage would be made up.
- The sentence moves to the next stage as soon as a stage's results are all in, not when the next stage's first result arrives: otherwise "Finding what matches" would sit there for 28 seconds after matching ended.
- The last sentence is "Putting your resume together", not "Making your PDF": the PDF is made when the button is pressed.
- "Show steps" leaves out the run's internal planning steps: they say nothing a visitor needs.
- A failed check shows as "A rewrite said more than your resume does. Redoing it.": the honest moment is worth showing, the checker's own wording is jargon.
- Every rewrite starts applied, and each can be undone with "Keep my original" inside the trace. This replaces the old accept/reject cards: the resume comes first, and the visitor keeps the last word.
- Highlighting is a standard word diff (longest common subsequence), written in 60 lines instead of using a library: it is the signature, so it should be ours, small and tested.
- A phrase that only moved is highlighted too: moving words can change what a sentence claims, so it should draw the eye.
- The original line is shown plain, with no strike-through marks: marking moved words as "removed" would mislead.
- Under the original line the trace also says which job requirements the line serves: it is what makes the change make sense.
- The trace opens on hover (mouse), tap or Enter; only one is open at a time; a closed panel is `inert`, so Tab never lands inside it.
- The summary says "Each one was checked against your resume", not "Nothing added that isn't in your resume": the first is a fact about this run, the second is the claim the eval has not measured yet.
- The match score ("covers 7 of 11 must-haves") is gone from the result: the chips already say what is missing.
- On a phone the Download button sticks to the bottom of the screen: the resume is first and long, and the main button should stay one tap away.
- The recorded run's download is the saved `example.pdf`; a live result, or one with a line kept, is drawn by `/api/pdf` as before.
- A file is refused in the browser when it is over 2 MB or not a PDF; a scanned PDF can only be caught by the server, which answers before any run is counted.
- A file dropped anywhere on the page is taken: a near miss would otherwise make the browser leave the page to open the PDF.
- Fields only complain after the button is pressed (or when a file is refused): nobody wants "too short" while they are still pasting.
- New endpoint `GET /api/status` (open, limited, paused): the page asks once, so a visitor is told the day's runs are gone before they upload anything. It reads only the site-wide count and is cached for 15 seconds.
- The status answer is also remembered in the server for 20 seconds: the endpoint has no bot check in front of it, and without this anyone could use up the Redis free quota just by asking.
- The limit message tells the two limits apart: "Today's free runs are gone" (site) and "You have used today's free run" (visitor).
- The limit message gives the reset as a clock time in the visitor's own zone, not "tomorrow": runs reset at midnight UTC, which is 5:30 in the morning in India.
- "Paused" has three causes: `DEMO_PAUSED=1` (a new manual switch), no Redis or Redis unreachable (the existing fail-closed), and the model account refusing for key, billing or quota.
- A model-account refusal mid-run now shows "paused" with the recorded run, not "try again in a minute": trying again would fail the same way.
- The bot check is set to show only when Cloudflare wants a click (`interaction-only`): most visitors never see it, and the form stays three steps.
- Pressing the button before the bot check has finished starts the run by itself when it does; if it never answers, after 20 seconds the server's refusal is shown instead of a stuck button.
- Leaving mid-run is guarded twice: the browser's own "Leave site?" box for closing the tab, and a question on in-site links. Only for a live run.
- The header button is hidden on `/try`: it leads to the page you are on.

## 4. The landing page

- Type: Fraunces (headlines) with Hanken Grotesk (everything else), chosen from eight pairings set side by side.
- Palette: warm paper, ink, and one accent, highlighter yellow, used only for changed words and the logo.
- The logo, the favicon and the link-preview image all use the same highlight: the signature is the brand.
- Headline shape: two short sentences, the second in italics on its own line.
- The headline says "Keep it true.", an aim, not "Nothing made up.", a claim: same reason the site said "built to" before.
- No speed claim in the hero: none has been measured. The facts line is "Free. No account. Nothing stored."
- "How it works" is three numbered lines with no icons and no cards.
- "Does it work?" and privacy sit side by side as two one-line sections with one link each.
- The eval link points at `/tree/main/eval` on GitHub. The eval folder is not on `main` yet, so the link is a 404 until the eval branch is merged.
- FAQ uses `<details>`: it works without JavaScript and costs nothing.
- No dark mode: the look is paper.

## 5. Other pages, icons, link preview

- `/example` is now the recorded run playing in the real flow, not a separate page design.
- The link-preview image is drawn at build time from copy.yaml (`app/opengraph-image.tsx`), so it follows the words without anyone redrawing it.
- Its fonts are three `.ttf` files in `web/assets/fonts` (open licence): the image library cannot use the fonts the pages load.
- The favicon is three lines with the middle one highlighted.
- Added a 404 page and an error page in the same shape as the notices.

## 6. Cleanup, speed, accessibility

- CSS for all motion, no animation library: one easing, 150 to 300 ms, and one rule that switches it all off for reduced motion.
- The headline font is two small local files (38 KB together) cut from Fraunces at optical size 72, not the 150 KB variable font: on a slow phone the headline waited on that download.
- The clock is its own component: a tick re-draws four characters, not the whole screen.
- Removed the `diff` dependency and the old `Trace`, `TryFlow` and `Workspace` components.
- Headings that receive focus from code show no ring (they are not controls); every control does.
- Lighthouse mobile on the production build, over several runs: performance 94 to 97 on the home page, 94 to 96 on the flow, 91 to 97 on the recorded run, 98 on privacy. Accessibility 100 and layout shift 0 on all four.

## 7. API glue and PDF

- PDF header: each contact line is split at "|" and pieces with no letter or digit are dropped, in `split_header` and again in `/api/pdf`, since that endpoint draws whatever the browser sends.
- The owner bypass was already in place; it is now covered on the new paths too (the status check is skipped for the owner).
- `make_example.py` writes the new fixture format, so a future recording works as a replay without hand edits.
- The result no longer carries `attempts` and `rejections` (the screen that showed them is gone) and gains `questions`.

## Not done

- The questions card only shows the questions. Answering them in the page would need the server to hold a run open while it waits for the visitor, which the "nothing is kept between requests" design rules out for now.
- The PDF layout is unchanged apart from the header fix.
- No analytics, no dark mode, no DOCX upload: not built yet.
