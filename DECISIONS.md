# Decisions

Each entry: the decision, the alternative, and why the alternative lost.

## Rung 4: evaluation

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
- **Alternative:** add real one-page cutting before the freeze, as the spec text assumed.
- **Why it lost:** it changes core agent logic one step before the freeze, with no time to test it. EVAL_PLAN.md states the real behaviour instead.

### D4. One output shape without the agent's IDs
- **Decision:** every system returns `TailoredResume` (sections, entries, lines as plain text). The agent's `ResumeJson` is converted by dropping evidence and bullet IDs.
- **Alternative:** make the baselines return the agent's exact `ResumeJson`.
- **Why it lost:** a baseline cannot know evidence IDs, and a scorer that reads them would be using the agent's own bookkeeping to score the agent.

### D5. "Unchanged" is tested against the raw PDF text
- **Decision:** a line is unchanged if its normalized text appears in the normalized text of the original PDF. Skills rows are split and scored skill by skill. Changed entry headers (title, organization, dates) are scored too.
- **Alternative:** compare against the agent's parsed evidence lines.
- **Why it lost:** the agent's parse can drop or split lines, so the test would depend on the system being scored. Headers are added because a baseline can change a job title there, and the spec's unit list would miss it.

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
- **Alternative:** the literal text "No answer", as the spec words it.
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
