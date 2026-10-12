"""The agent's tools, and the state they work on.

The agent model only ever asks for a tool by name with IDs. Everything it asks
for passes through this file, and this file is where the rules are enforced:

- a bullet can only be written for a requirement that has evidence (refusal)
- a line gets at most MAX_ATTEMPTS rewrites (the retry limit)
- only bullets that passed verification can be assembled
- the user is asked at most MAX_QUESTIONS questions

So the model makes the choices, but it cannot break these rules even if a
prompt injection in the resume or JD tells it to.
"""

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from resume_agent import llm
from resume_agent.assemble import ResumeJson, build_resume, check_resume
from resume_agent.extract import Link
from resume_agent.models import (
    Entry,
    EvidenceLine,
    Requirement,
    TailoredBullet,
    TraceStep,
    Verification,
)
from resume_agent.parsing import normalize
from resume_agent.tools import RewriteJob, rewrite_bullets, search_all_evidence
from resume_agent.verify import verify_claims

MAX_ATTEMPTS = 3  # rewrites per resume line: the first try plus two retries
MAX_QUESTIONS = 3  # questions to the user per run

# Answers that carry no fact. They never become evidence.
NO_ANSWERS = {"", "no", "n", "none", "skip", "idk", "i don't know", "not sure"}

AskUser = Callable[[str], str]  # takes the question, returns the user's answer
Outcome = tuple[str, dict[str, Any]]  # (decision for the trace, output for the agent)

_REASON = Field(description="One short sentence: why you are making this call.")


# --- Tool arguments ----------------------------------------------------------
# One model per tool. It validates what the agent sends, and its JSON schema is
# what Gemini is shown as the tool's parameters. The docstring is the tool's
# description, so the code and what the model reads can never drift apart.


class SearchEvidence(BaseModel):
    """Find the resume lines that support one requirement. Returns evidence IDs,
    strongest first. An empty list means the requirement is a gap."""

    requirement_id: str
    reason: str = _REASON


class RejectRequirement(BaseModel):
    """Mark a requirement as a gap without writing anything for it. Use this for
    a requirement no resume line can honestly show."""

    requirement_id: str
    reason: str = _REASON


class RewriteBullet(BaseModel):
    """Rewrite one resume line so the given requirements stand out. Calling it
    again for the same line is a retry: the last verification's violations are
    sent to the writer for you. Each line has a limited number of attempts."""

    evidence_ids: list[str] = Field(
        description="First the resume line to rewrite. Then, optionally, IDs of "
        "user-confirmed facts (U1, U2, ...) the bullet may also use."
    )
    requirement_ids: list[str] = Field(
        description="Every requirement this line is evidence for."
    )
    reason: str = _REASON


class VerifyClaim(BaseModel):
    """Check a rewritten bullet against its source lines. A bullet must pass
    before it can be assembled."""

    bullet_id: str
    reason: str = _REASON


class DropBullet(BaseModel):
    """Give up on a rewritten bullet. The original resume line stays."""

    bullet_id: str
    reason: str = _REASON


class AskUserQuestion(BaseModel):
    """Ask the user one question, only when the resume is ambiguous about a fact
    that a requirement depends on. A real answer becomes a new evidence line."""

    question: str = Field(
        description="Ask for a fact, so that the answer states it in the user's "
        'own words: "Which language did you write X in?", not "Did you use Python?"'
    )
    requirement_id: str
    reason: str = _REASON


class AssembleResume(BaseModel):
    """Build the final resume from the bullets you choose. Call it once, at the
    end. If a check fails you get the problems back and can try again."""

    bullet_ids: list[str] = Field(
        description="Verified bullets to include. Lines without a bullet keep "
        "their original text."
    )
    reason: str = _REASON


def _refuse(message: str) -> Outcome:
    return "refused", {"error": message}


@dataclass
class Session:
    """Everything known about one run. Tools read and change this, nothing else."""

    evidence: dict[str, EvidenceLine]  # resume lines by ID, in resume order
    requirements: dict[str, Requirement]
    links: list[Link]
    ask_user: AskUser
    # False only for the eval's ablation (system A0): verify_claim then passes
    # every bullet unchecked. The loop, tools and prompts stay exactly the same.
    verifier_on: bool = True
    # field(default_factory=...) gives each Session its own empty container.
    confirmed: dict[str, EvidenceLine] = field(default_factory=dict)  # user answers
    # requirement ID -> evidence IDs. A key exists only once it was searched.
    matches: dict[str, list[str]] = field(default_factory=dict)
    rejected: dict[str, str] = field(default_factory=dict)  # requirement ID -> reason
    bullet_ids: dict[str, str] = field(default_factory=dict)  # line ID -> bullet ID
    bullets: dict[str, TailoredBullet] = field(default_factory=dict)  # current drafts
    verified: set[str] = field(default_factory=set)  # bullet IDs that passed
    # line ID -> requirements, for lines the writer chose to leave unchanged.
    kept_original: dict[str, list[str]] = field(default_factory=dict)
    attempts: dict[str, int] = field(default_factory=dict)  # line ID -> rewrites
    violations: dict[str, list[str]] = field(default_factory=dict)  # last failure
    questions_asked: int = 0
    resume: ResumeJson | None = None  # set once assembly succeeds; ends the loop
    trace: list[TraceStep] = field(default_factory=list)

    # --- helpers -------------------------------------------------------------

    def line(self, evidence_id: str) -> EvidenceLine | None:
        """Look an ID up among resume lines, then among user-confirmed facts."""
        return self.evidence.get(evidence_id) or self.confirmed.get(evidence_id)

    def log(
        self,
        tool: str,
        input: dict[str, Any],
        output: dict[str, Any],
        decision: str,
        latency_ms: int = 0,
        tokens_in: int = 0,
        tokens_out: int = 0,
        cost: float | None = None,
    ) -> None:
        self.trace.append(
            TraceStep(
                step=len(self.trace) + 1,
                tool=tool,
                input=input,
                output=output,
                decision=decision,
                latency_ms=latency_ms,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost=cost,
            )
        )

    def refresh_status(self) -> None:
        """Work out each requirement's status from the current state.

        Recomputing from scratch after every turn is simpler and safer than
        updating statuses in each tool, where one missed case leaves them wrong.
        """
        covered = {
            req_id
            for bullet in self.bullets.values()
            if bullet.id in self.verified
            for req_id in bullet.requirement_ids
        }
        covered |= {r for reqs in self.kept_original.values() for r in reqs}
        for req in self.requirements.values():
            searched_empty = req.id in self.matches and not self.matches[req.id]
            if req.id in covered:
                req.status = "covered"
            elif req.id in self.rejected or searched_empty:
                req.status = "gap"
            else:
                req.status = "pending"

    # --- tools ---------------------------------------------------------------
    # Every tool takes ALL calls of its kind from one agent turn and returns one
    # outcome per call, in the same order. That is what lets twenty searches
    # cost one model call.

    def search_evidence(self, calls: list[SearchEvidence]) -> list[Outcome]:
        outcomes: dict[int, Outcome] = {}
        todo: list[tuple[int, Requirement]] = []
        for i, call in enumerate(calls):
            req = self.requirements.get(call.requirement_id)
            if req is None:
                outcomes[i] = _refuse(f"Unknown requirement {call.requirement_id}.")
            elif req.id in self.matches:  # already searched: answer from memory
                outcomes[i] = "cached", {"evidence_ids": self.matches[req.id]}
            else:
                todo.append((i, req))
        if todo:
            found = search_all_evidence(
                [req for _, req in todo], list(self.evidence.values())
            )
            for i, req in todo:
                self.matches[req.id] = found[req.id]
                if found[req.id]:
                    outcomes[i] = "evidence found", {"evidence_ids": found[req.id]}
                else:
                    outcomes[i] = "gap", {
                        "evidence_ids": [],
                        "note": "No evidence. This is a gap. Write nothing for it.",
                    }
        return [outcomes[i] for i in range(len(calls))]

    def reject_requirement(self, calls: list[RejectRequirement]) -> list[Outcome]:
        outcomes: list[Outcome] = []
        for call in calls:
            if call.requirement_id not in self.requirements:
                outcomes.append(_refuse(f"Unknown requirement {call.requirement_id}."))
                continue
            self.rejected[call.requirement_id] = call.reason
            outcomes.append(("reject", {"status": "gap"}))
        return outcomes

    def _rewrite_problem(self, call: RewriteBullet, taken: set[str]) -> str | None:
        """Why this rewrite is not allowed, or None if it is."""
        if not call.evidence_ids or not call.requirement_ids:
            return "Give at least one evidence ID and one requirement ID."
        unknown = [i for i in call.evidence_ids if self.line(i) is None]
        unknown += [i for i in call.requirement_ids if i not in self.requirements]
        if unknown:
            return f"Unknown IDs: {', '.join(unknown)}."
        target = call.evidence_ids[0]
        if target not in self.evidence:
            return f"The first evidence ID must be a resume line, not {target}."
        if target in taken:
            return f"Line {target} is already being rewritten in this turn."
        if self.attempts.get(target, 0) >= MAX_ATTEMPTS:
            return (
                f"Line {target} has used all {MAX_ATTEMPTS} attempts. "
                "Drop its bullet, or ask the user if a fact is unclear."
            )
        for req_id in call.requirement_ids:
            if req_id not in self.matches:
                return f"Call search_evidence for {req_id} first."
            # The refusal rule: the cited lines must be evidence for the
            # requirement, as found by search. No evidence, no bullet.
            if not set(call.evidence_ids) & set(self.matches[req_id]):
                found = ", ".join(self.matches[req_id]) or "none (it is a gap)"
                return (
                    f"None of the cited lines is evidence for {req_id}. "
                    f"Its evidence is: {found}."
                )
        return None

    def rewrite_bullet(self, calls: list[RewriteBullet]) -> list[Outcome]:
        outcomes: dict[int, Outcome] = {}
        jobs: list[RewriteJob] = []
        slots: list[tuple[int, EvidenceLine, RewriteBullet]] = []
        taken: set[str] = set()  # lines already claimed by an earlier call this turn
        for i, call in enumerate(calls):
            problem = self._rewrite_problem(call, taken)
            if problem:
                outcomes[i] = _refuse(problem)
                continue
            target = self.evidence[call.evidence_ids[0]]
            taken.add(target.id)
            # A line keeps one bullet ID for life, so a retry updates the same
            # bullet. setdefault only assigns a new ID the first time.
            bullet_id = self.bullet_ids.setdefault(
                target.id, f"B{len(self.bullet_ids) + 1}"
            )
            jobs.append(
                RewriteJob(
                    bullet_id=bullet_id,
                    sources=[self.line(e) for e in call.evidence_ids],
                    requirements=[self.requirements[r] for r in call.requirement_ids],
                    # On a retry this carries the last failure to the writer.
                    violations=self.violations.get(bullet_id, []),
                )
            )
            slots.append((i, target, call))

        written = {b.id: b for b in rewrite_bullets(jobs)} if jobs else {}
        for (i, target, call), job in zip(slots, jobs):
            self.attempts[target.id] = self.attempts.get(target.id, 0) + 1
            left = MAX_ATTEMPTS - self.attempts[target.id]
            # Whatever was true of the old draft no longer holds for a new one.
            self.verified.discard(job.bullet_id)
            self.kept_original.pop(target.id, None)
            bullet = written.get(job.bullet_id)
            if bullet is None:
                self.bullets.pop(job.bullet_id, None)
                outcomes[i] = "no bullet", {
                    "error": "The writer returned nothing.",
                    "attempts_left": left,
                }
            elif normalize(bullet.text) == normalize(target.text):
                # Same words as the resume: nothing to propose, nothing to verify.
                self.bullets.pop(job.bullet_id, None)
                self.kept_original[target.id] = call.requirement_ids
                outcomes[i] = "keep original", {
                    "status": "unchanged",
                    "note": "The original line already fits and stays as it is. "
                    "Its requirements are covered. Do not verify it.",
                }
            else:
                bullet.replaces = target.id  # placement is decided here, in code
                self.bullets[bullet.id] = bullet
                outcomes[i] = "rewritten", {
                    "bullet_id": bullet.id,
                    "text": bullet.text,
                    "attempts_left": left,
                }
        return [outcomes[i] for i in range(len(calls))]

    def verify_claim(self, calls: list[VerifyClaim]) -> list[Outcome]:
        outcomes: dict[int, Outcome] = {}
        todo: list[tuple[int, TailoredBullet]] = []
        for i, call in enumerate(calls):
            bullet = self.bullets.get(call.bullet_id)
            if bullet is None:
                outcomes[i] = _refuse(f"Unknown bullet {call.bullet_id}.")
            elif bullet.id in self.verified:  # already passed: no need to pay again
                outcomes[i] = "keep", {"passed": True}
            else:
                todo.append((i, bullet))
        if self.verifier_on:
            results = verify_claims(
                [(b, [self.line(s) for s in b.source_ids]) for _, b in todo]
            )
        else:
            # Ablation: no rules, no judge, no model call. The agent gets the same
            # answer a real pass gives, so it cannot tell the verifier is off.
            results = {b.id: Verification(passed=True, layer="rules") for _, b in todo}
        # The trace (not the agent) records that this pass was never checked.
        kept = "keep" if self.verifier_on else "keep, verifier off"
        for i, bullet in todo:
            result = results[bullet.id]
            if result.passed:
                self.verified.add(bullet.id)
                self.violations.pop(bullet.id, None)
                outcomes[i] = kept, {"passed": True}
                continue
            self.violations[bullet.id] = result.violations  # kept for the retry
            left = MAX_ATTEMPTS - self.attempts.get(bullet.replaces, 0)
            outcomes[i] = ("retry" if left else "out of retries"), {
                "passed": False,
                "layer": result.layer,
                "violations": result.violations,
                "attempts_left": left,
                "next": "Call rewrite_bullet for this line again."
                if left
                else "No attempts left. Call drop_bullet, or ask_user if a fact "
                "is unclear.",
            }
        return [outcomes[i] for i in range(len(calls))]

    def drop_bullet(self, calls: list[DropBullet]) -> list[Outcome]:
        outcomes: list[Outcome] = []
        for call in calls:
            if self.bullets.pop(call.bullet_id, None) is None:
                outcomes.append(_refuse(f"Unknown bullet {call.bullet_id}."))
                continue
            self.verified.discard(call.bullet_id)
            self.violations.pop(call.bullet_id, None)
            outcomes.append(("drop", {"status": "The original line stays."}))
        return outcomes

    def ask_user_question(self, calls: list[AskUserQuestion]) -> list[Outcome]:
        outcomes: list[Outcome] = []
        for call in calls:
            if call.requirement_id not in self.requirements:
                outcomes.append(_refuse(f"Unknown requirement {call.requirement_id}."))
                continue
            if self.questions_asked >= MAX_QUESTIONS:
                outcomes.append(
                    _refuse(f"The limit of {MAX_QUESTIONS} questions is used up.")
                )
                continue
            self.questions_asked += 1
            answer = normalize(self.ask_user(call.question))
            if answer.lower().rstrip(".!") in NO_ANSWERS:
                outcomes.append(("no answer", {"answer": answer, "evidence_id": None}))
                continue
            # The user's own words become a new evidence line. Only the answer is
            # stored, never the question, so the agent cannot plant a fact by
            # putting it in a question the user answers with "yes".
            fact = EvidenceLine(
                id=f"U{len(self.confirmed) + 1}",
                section="Confirmed by user",
                entry=Entry(),
                text=answer,
            )
            self.confirmed[fact.id] = fact
            lines = self.matches.setdefault(call.requirement_id, [])
            for line_id in lines:
                if line_id in self.attempts:  # new fact: allow one more rewrite
                    self.attempts[line_id] = min(
                        self.attempts[line_id], MAX_ATTEMPTS - 1
                    )
            lines.append(fact.id)
            outcomes.append(
                (
                    "answered",
                    {
                        "answer": answer,
                        "evidence_id": fact.id,
                        "note": f"To use this fact, cite {fact.id} after the resume "
                        "line in evidence_ids.",
                    },
                )
            )
        return outcomes

    def assemble_resume(self, calls: list[AssembleResume]) -> list[Outcome]:
        outcomes: list[Outcome] = []
        for position, call in enumerate(calls):
            if position > 0:
                outcomes.append(_refuse("Only one assemble_resume call per turn."))
                continue
            ids = list(dict.fromkeys(call.bullet_ids))  # drop repeats, keep order
            not_ready = [i for i in ids if i not in self.verified]
            if not_ready:
                outcomes.append(
                    _refuse(
                        f"Not verified, so not allowed: {', '.join(not_ready)}. "
                        "Only bullets that passed verify_claim can be assembled."
                    )
                )
                continue
            chosen = [self.bullets[i] for i in ids]
            lines = list(self.evidence.values())
            resume = build_resume(lines, chosen, self.links)
            problems = check_resume(resume, lines, chosen, self.links)
            if problems:
                outcomes.append(("rejected", {"ok": False, "problems": problems}))
                continue
            # Bullets the agent left out are removed, so "covered" below only
            # counts what is really on the assembled resume.
            self.bullets = {b.id: b for b in chosen}
            self.verified &= set(ids)
            self.resume = resume
            outcomes.append(("assembled", {"ok": True, "bullets_used": len(ids)}))
        return outcomes

    def assemble_fallback(self) -> None:
        """Assemble without the agent, for when it ran out of steps.

        Uses every verified bullet. If that fails a check, falls back to the
        original resume, which always passes.
        """
        lines = list(self.evidence.values())
        chosen = [b for b in self.bullets.values() if b.id in self.verified]
        resume = build_resume(lines, chosen, self.links)
        problems = check_resume(resume, lines, chosen, self.links)
        if problems:
            chosen = []
            resume = build_resume(lines, chosen, self.links)
        self.bullets = {b.id: b for b in chosen}
        self.verified &= set(self.bullets)
        self.resume = resume
        self.refresh_status()
        self.log(
            "assemble_resume",
            {"bullet_ids": [b.id for b in chosen]},
            {"ok": True, "problems_with_all_bullets": problems},
            "fallback",
        )

    # --- running a turn's calls ----------------------------------------------

    def execute(self, calls: list[tuple[str, dict[str, Any]]]) -> list[dict[str, Any]]:
        """Run every tool call from one agent turn. Returns one output per call."""
        outputs: list[dict[str, Any]] = [{} for _ in calls]
        # Fixed order, so a search always lands before a rewrite that relies on it
        # when the agent sends both in one turn.
        for name, (args_model, handler) in self.tools().items():
            batch: list[tuple[int, BaseModel]] = []
            for i, (called, raw) in enumerate(calls):
                if called != name:
                    continue
                try:
                    batch.append((i, args_model.model_validate(raw)))
                except ValidationError as err:  # the agent sent malformed arguments
                    outputs[i] = {"error": f"Bad arguments: {err.errors()[0]['msg']}"}
                    self.log(name, raw, outputs[i], "refused")
            if not batch:
                continue
            snapshot = llm.usage_snapshot()
            started = time.perf_counter()
            try:
                outcomes = handler([args for _, args in batch])
            except Exception as err:  # noqa: BLE001
                # A tool that crashes (model overloaded, malformed model output)
                # must not kill the run. Report it; the agent can try again.
                outcomes = [("error", {"error": f"{name} failed: {err}"})] * len(batch)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            tokens_in, tokens_out, cost = llm.usage_since(snapshot)
            share = len(batch)  # the batch was one piece of work: split its cost
            for (i, args), (decision, output) in zip(batch, outcomes):
                outputs[i] = output
                self.log(
                    name,
                    args.model_dump(),
                    output,
                    decision,
                    latency_ms=elapsed_ms // share,
                    tokens_in=tokens_in // share,
                    tokens_out=tokens_out // share,
                    cost=None if cost is None else cost / share,
                )
        for i, (called, raw) in enumerate(calls):
            if called not in self.tools():  # the agent made up a tool name
                outputs[i] = {"error": f"Unknown tool {called}."}
                self.log(called, raw, outputs[i], "refused")
        self.refresh_status()
        return outputs

    def tools(self) -> dict[str, tuple[type[BaseModel], Callable[..., list[Outcome]]]]:
        """Tool name -> (argument model, handler), in the order they run."""
        return {
            "search_evidence": (SearchEvidence, self.search_evidence),
            "reject_requirement": (RejectRequirement, self.reject_requirement),
            "rewrite_bullet": (RewriteBullet, self.rewrite_bullet),
            "verify_claim": (VerifyClaim, self.verify_claim),
            "drop_bullet": (DropBullet, self.drop_bullet),
            "ask_user": (AskUserQuestion, self.ask_user_question),
            "assemble_resume": (AssembleResume, self.assemble_resume),
        }
