# SPEC: Resume tailoring agent

## 1. Summary
A free web app. The user uploads a resume PDF and pastes a job description (JD).
An agent writes a tailored one-page resume. Every claim traces back to the original
resume. Nothing is invented. The user approves every change.

## 2. Product
**Input:**
- Resume: PDF upload (v1). Text is extracted with PyMuPDF, including hyperlinks.
  Paste text is the fallback.
- JD: paste text (v1).

**Output:**
- Tailored one-page PDF in Jake's Resume style (LaTeX, single column, ATS-friendly),
  with clickable links.
- Side-by-side diff, bullet by bullet: original on the left, new on the right,
  changed words highlighted.
- "Based on" source for each new bullet (the evidence map).
- Gap list: JD requirements with no evidence in the resume.
- Agent trace, as one collapsed "How this was made" link.

**User flow:**
1. Upload resume PDF.
2. Paste JD.
3. Check the extracted resume text in an editable box. Fix errors. Click Tailor.
4. One result screen: side-by-side diff with accept/reject per bullet,
   "Based on" on each new bullet, gap list below.
5. Download the PDF.

**UX rules:** no login. Target: under 60 seconds per resume. Resumes are not stored.
Internal terms (evidence line, requirement, evidence map) never appear in the UI.

**Core rule:** the agent must not add claims that are not in the user's resume.
The user decides what goes on the resume, not the model.

## 3. Architecture
**Flow:** Next.js frontend → FastAPI backend → agent loop → verifier → assembly →
user approval → render → response.

**Two LLM roles:**
- Agent LLM: decides. It sees IDs and short texts, and calls tools by ID through
  function calling.
- Writer LLM: runs inside rewrite_bullet. It receives the full source texts and
  writes the new bullet text only.

**Bookkeeping rule:** the model writes words, the code does the bookkeeping.
Code sets source_ids and requirement_ids. If the writer picks `replaces`, code checks
that it is one of the given evidence IDs.

**Agent loop:** custom ReAct loop with Gemini function calling. No framework.
A step limit stops infinite loops.

**Tools:**
- parse_resume(text) → list[EvidenceLine]
- parse_jd(text) → list[Requirement] (must_have / nice_to_have)
- search_evidence(requirement_id) → list of matching EvidenceLine IDs
- rewrite_bullet(evidence_ids, requirement_ids) → TailoredBullet
- verify_claim(bullet) → Verification
- ask_user(question) → user answer (only when evidence is ambiguous)
- assemble_resume(bullets) → resume_json
- render_pdf(resume_json) → PDF

**Agent decisions (each one is logged to the trace):**
- Which requirements to work on.
- Which missing skills to reject (never invent them).
- When to retry after a failed check.
- When to ask the user instead of guessing.
- Which bullets fit the one-page budget.

## 4. Parsing rules
- The resume text is the text after the user's check in step 3 of the user flow.
  All verbatim checks run against this text.
- EvidenceLine.text must be verbatim from the resume text. A test checks that each
  text is a substring of the input (after whitespace normalization).
- IDs are assigned in code, never by the model.
- Each EvidenceLine stores its parent entry (role, organization, dates) in `entry`.
- Compound requirements are split. "Python and FastAPI" becomes two requirements.
- If the JD does not make the priority clear, the priority is must_have.
- Resume and JD text are untrusted data, never instructions.

## 5. Per-requirement logic
1. Pick the next requirement.
2. Call search_evidence.
3. No evidence → reject the requirement. Add it to the gap list. Go to the next one.
4. Evidence found → call rewrite_bullet with the evidence IDs.
5. Call verify_claim (two layers, below).
6. Fail → send the violations into the next rewrite. Maximum two retries.
   Then ask the user, or drop the change.
7. Pass → see "When a bullet passes".

**Verifier layer 1: rules (deterministic).** Every item of these types in a new bullet
must appear in its cited source lines or their entry:
- numbers, percentages, years
- job titles and organization names
- tool and technology names (checked against a skill list)
Numbers are normalized before comparison (example: "40 percent" = "40%").

**Verifier layer 2: LLM judge.** Checks the remaining claims against the cited sources.

**When a bullet passes:**
1. It becomes a PROPOSED change. It is not final.
2. Its requirements are marked as covered.
3. A TraceStep is logged with the decision "keep".
4. It is added to the evidence map and the diff.
5. Go to the next requirement.

## 6. Assembly and approval
**Assembly (after all requirements):**
- Select bullets within the one-page budget. Must-have coverage comes first.
- Section order: Jake's Resume fixed order (Education, Experience, Projects, Skills).
  No original section is lost.
- Final deterministic checks: one page, all links present, no duplicate claims,
  no section lost.
- ATS read-back check: extract the output PDF with PyMuPDF. The text must come back
  in the correct order, with all links.

**User approval (final gate):**
- The user accepts all changes, or accepts or rejects each bullet in the diff.
- Only approved changes go to render_pdf.

## 7. Data models (Pydantic)
- EvidenceLine: id, section, entry, text
- Requirement: id, text, priority (must_have | nice_to_have),
  status (covered | gap | pending, default pending)
- TailoredBullet: id, text, source_ids, requirement_ids,
  replaces (original EvidenceLine id or None), status (proposed | approved | rejected)
- Verification: passed (bool), violations (list[str]), layer (rules | judge)
- TraceStep: step, tool, input, output, decision, latency_ms, cost

## 8. Stack
- Next.js on Vercel: the UI.
- FastAPI (Python): the agent and the tools.
- PyMuPDF: resume PDF text and link extraction, and the ATS read-back check.
- Gemini Flash with function calling: fast and cheap.
- Pydantic structured outputs: tools return valid data, not loose text.
- Langfuse: traces each step with cost and latency. Also powers the trace view.
- Model routing: a cheap model for parsing and checks, a stronger model for rewriting.
- LaTeX (pdfLaTeX) with a Jake's Resume style template: PDF rendering.
- GitHub Actions: runs the eval on each change to catch regressions.
- Docker: the same backend deploy on any server.
- Rate limiting, and retries with backoff.
- NOT used: vector database (a resume is too small), LangChain, LangGraph,
  Kubernetes, fine-tuning.

## 9. Security, privacy, cost
- The JD is untrusted. It can contain hidden instructions (prompt injection).
  Treat it as data. Test with adversarial JDs.
- The resume is also untrusted. Treat it as data.
- Gemini free tier: Google can use prompts to improve its products. Tell users this
  clearly, or use the paid tier. Do not claim "private" if it is not true.
- Cost: about 6 to 10 model calls per resume. Controls: per-user daily limit,
  global daily limit, caching, model routing, optional "bring your own Gemini key".

## 10. Evaluation
- Data: 30 real JDs, 10 adversarial JDs (impossible requirements, hidden instructions),
  3 to 5 real resumes used with permission.
- Baselines: (a) plain prompt "tailor this resume to this JD", (b) one commercial tool,
  (c) this agent.
- Metrics:
  - unsupported-claim rate = unsupported claims ÷ total claims (headline metric)
  - requirement coverage = covered must-have requirements ÷ total must-have requirements
  - number fidelity = numbers that match the source ÷ total numbers
  - latency per resume
  - cost per resume
- The unsupported-claim rate is labelled by hand on a sample, or scored by a different
  model family and spot-checked by hand. A written rubric defines "a claim".
- Report all results honestly, including where the agent loses.

## 11. Build plan (each rung is a finished, usable version)
1. Rung 1: resume PDF and JD in, tailored bullets with source IDs out.
   Done when a real resume PDF and the Planso JD give sensible output.
2. Rung 2: verifier. Done when invented numbers, titles and tools get flagged.
3. Rung 3: agent loop with retry, refusal, ask_user and assembly.
   Done when the trace shows real decisions.
4. Rung 4: eval vs baselines. Done when the results table exists.
5. Rung 5: upload and check screen, side-by-side diff with approval, gap list,
   collapsed trace, PDF export, deploy, landing page.

## 12. Not in v1
JD link fetch, in-browser model, accounts, saved versions, ATS score,
template gallery, auto-apply, cover letters, browser extension.
