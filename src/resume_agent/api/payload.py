"""Shape a finished Session, and each trace step, into JSON for the browser.

Nothing here is a sentence. A step is sent as a `kind` plus the few facts that
belong to it, and the browser turns that into words from web/content/copy.yaml.
That keeps every visible string in one file, and keeps IDs like "E3" off the
screen: the browser is given the texts, never the IDs.
"""

from typing import Any

from resume_agent.api.redact import restore
from resume_agent.models import TraceStep
from resume_agent.session import Session

# Trace steps with these decisions are answers the user was actually asked for.
_ASKED = {"no answer", "answered"}


def restore_all(value: Any, found: dict[str, str]) -> Any:
    """Put contact details back into every string inside a nested structure."""
    if isinstance(value, str):
        return restore(value, found)
    if isinstance(value, list):
        return [restore_all(item, found) for item in value]
    if isinstance(value, dict):
        return {key: restore_all(item, found) for key, item in value.items()}
    return value


def _requirement(session: Session, requirement_id: str) -> str:
    """The requirement's own words, or "" if the agent sent an unknown ID."""
    req = session.requirements.get(requirement_id)
    return req.text if req else ""


def _line(session: Session, evidence_ids: list[str] | None) -> str:
    """The resume line a rewrite was about: the first ID is the line to rewrite."""
    line = session.line(evidence_ids[0]) if evidence_ids else None
    return line.text if line else ""


def describe_step(step: TraceStep, session: Session) -> dict[str, Any]:
    """One trace step as a `kind` and its facts. See web/lib/types.ts for the list."""
    tool, decision, given, out = step.tool, step.decision, step.input, step.output
    kind = "other"  # a tool this file does not know: the browser shows nothing for it
    facts: dict[str, Any] = {}

    if tool == "parse_resume":
        kind, facts = "read_resume", {"count": out["items"]}
    elif tool == "parse_jd":
        kind, facts = "read_job", {"count": out["items"]}
    elif tool == "agent":
        names: list[str] = out.get("calls", [])
        # What the agent decided to do next, as tool name -> how many calls.
        # dict.fromkeys keeps one of each name, in the order first seen.
        kind, facts = "plan", {"calls": {n: names.count(n) for n in dict.fromkeys(names)}}
    elif decision == "refused":
        kind = "refused"  # the guard in session.py said no to a call
    elif decision == "error":
        kind = "tool_error"  # a model call failed; the agent can try again
    elif tool == "search_evidence":
        found = out.get("evidence_ids") or []
        kind = "match_found" if found else "match_missing"
        facts = {"requirement": _requirement(session, given.get("requirement_id", ""))}
        if found:
            facts["count"] = len(found)  # how many resume lines show it
    elif tool == "reject_requirement":
        kind = "match_missing"
        facts = {"requirement": _requirement(session, given.get("requirement_id", ""))}
    elif tool == "rewrite_bullet":
        facts = {"before": _line(session, given.get("evidence_ids"))}
        if decision == "rewritten":
            kind, facts["after"] = "rewrote", out["text"]
        elif decision == "keep original":
            kind = "kept"
        else:
            kind = "rewrite_empty"  # the writer returned nothing: the line stays
    elif tool == "verify_claim":
        kind = "check_passed" if out.get("passed") else "check_failed"
    elif tool == "drop_bullet":
        kind = "dropped"
    elif tool == "ask_user":
        kind, facts = "asked", {"question": given.get("question", "")}
    elif tool == "assemble_resume":
        if decision == "assembled":
            kind, facts = "assembled", {"count": out["bullets_used"]}
        elif decision == "fallback":
            kind = "assembled_fallback"  # out of turns: finished in code
        else:
            kind = "assemble_retry"  # a check failed and the agent tries again
    return {"n": step.step, "kind": kind, "ms": step.latency_ms, **facts}


def arrival_times(trace: list[TraceStep]) -> list[int]:
    """When each step reached the browser, in milliseconds from the start.

    A live run sends steps in bursts, not one by one: both parse steps arrive
    together once parsing is done, and all the results of one tool arrive
    together when that tool's single model call returns. A saved run only has
    each step's own latency, so this rebuilds the bursts from them. The replay
    in the browser uses these times, which is why it moves like a real run.
    """
    times: list[int] = []
    clock = 0
    start = 0  # index of the first step of the burst being built
    for i, step in enumerate(trace):
        clock += step.latency_ms
        nxt = trace[i + 1] if i + 1 < len(trace) else None
        # A burst ends when the next step comes from a different tool. The two
        # parse steps count as one burst: the trace is not visible before both.
        same_burst = nxt is not None and (
            nxt.tool == step.tool or {step.tool, nxt.tool} == {"parse_resume", "parse_jd"}
        )
        if not same_burst:
            times.extend([clock] * (i + 1 - start))  # the whole burst lands now
            start = i + 1
    return times


def questions(session: Session) -> list[str]:
    """Questions the agent put to the user, in the order it asked them."""
    return [
        step.input["question"]
        for step in session.trace
        if step.tool == "ask_user" and step.decision in _ASKED and step.input.get("question")
    ]


def build_result(session: Session, header: list[str], seconds: float) -> dict[str, Any]:
    """Everything the result screen needs. Still holds placeholders."""
    assert session.resume is not None  # run_agent always assembles before returning
    costs = [step.cost for step in session.trace]
    return {
        "header": header,
        "links": [link.model_dump() for link in session.resume.links],
        "sections": [
            {
                "name": section.name,
                "entries": [
                    {
                        **entry.entry.model_dump(),
                        "lines": [
                            {
                                "evidence_id": line.evidence_id,
                                # The line before any rewrite: what "keep my
                                # original" puts back, and what the trace shows.
                                "original": session.evidence[line.evidence_id].text,
                                "bullet_id": line.bullet_id,
                            }
                            for line in entry.lines
                        ],
                    }
                    for entry in section.entries
                ],
            }
            for section in session.resume.sections
        ],
        "bullets": [
            {
                "id": bullet.id,
                "text": bullet.text,
                "replaces": bullet.replaces,
                "source_ids": bullet.source_ids,
                "requirement_ids": bullet.requirement_ids,
            }
            for bullet in session.bullets.values()
        ],
        # Every line a bullet can cite, by ID, so the trace can show its source.
        "evidence": {
            line.id: line.text
            for line in [*session.evidence.values(), *session.confirmed.values()]
        },
        "requirements": [
            {
                "id": req.id,
                "text": req.text,
                "priority": req.priority,
                # Rewritten bullets that cover it.
                "bullet_ids": [
                    b.id for b in session.bullets.values() if req.id in b.requirement_ids
                ],
                # Original lines the writer chose not to change that cover it.
                "kept_line_ids": [
                    line_id
                    for line_id, req_ids in session.kept_original.items()
                    if req.id in req_ids
                ],
            }
            for req in session.requirements.values()
        ],
        "questions": questions(session),
        "stats": {
            "seconds": round(seconds, 1),
            "steps": len(session.trace),
            "tokens_in": sum(step.tokens_in for step in session.trace),
            "tokens_out": sum(step.tokens_out for step in session.trace),
            # None when any step used a model with no known price.
            "cost_usd": None if None in costs else round(sum(costs), 5),
        },
    }
