"""Shape a finished Session, and each trace step, into JSON for the browser."""

from typing import Any

from resume_agent.api.redact import restore
from resume_agent.models import TraceStep
from resume_agent.session import Session


def restore_all(value: Any, found: dict[str, str]) -> Any:
    """Put contact details back into every string inside a nested structure."""
    if isinstance(value, str):
        return restore(value, found)
    if isinstance(value, list):
        return [restore_all(item, found) for item in value]
    if isinstance(value, dict):
        return {key: restore_all(item, found) for key, item in value.items()}
    return value


def _quote(session: Session, requirement_id: str) -> str:
    req = session.requirements.get(requirement_id)
    return f"“{req.text}”" if req else requirement_id


def describe_step(step: TraceStep, session: Session) -> dict[str, Any]:
    """One trace step as a short headline and detail a visitor can read.

    kind drives the colour on screen: ok, gap, bad, warn or info.
    """
    tool, decision, given, out = step.tool, step.decision, step.input, step.output
    kind, title, detail = "info", f"{tool}: {decision}", ""

    if tool == "parse_resume":
        title = f"Read your resume: {out['items']} evidence lines"
        detail = "Each line is copied word for word. Nothing else can be cited."
    elif tool == "parse_jd":
        title = f"Read the job description: {out['items']} requirements"
    elif tool == "agent":
        names: list[str] = out.get("calls", [])
        # dict.fromkeys keeps one of each name, in the order first seen.
        counts = [f"{names.count(n)} × {n}" for n in dict.fromkeys(names)]
        title = f"Agent turn {given.get('turn')}: planned {len(names)} tool calls"
        detail = ", ".join(counts)
    elif decision == "refused":
        kind, title = "warn", f"Guard refused a {tool} call"
        detail = out.get("error", "")
    elif decision == "error":
        kind, title = "warn", f"{tool} failed, the agent was told"
        detail = "A model call did not complete. The agent can try again."
    elif tool == "search_evidence":
        req = _quote(session, given.get("requirement_id", ""))
        if out.get("evidence_ids"):
            kind, title = "ok", f"Found evidence for {req}"
            detail = "Resume lines " + ", ".join(out["evidence_ids"])
        else:
            kind, title = "gap", f"No evidence for {req}"
            detail = "Goes to the gap report. Nothing is written for it."
    elif tool == "reject_requirement":
        kind, title = "gap", f"Marked as a gap: {_quote(session, given.get('requirement_id', ''))}"
        detail = given.get("reason", "")
    elif tool == "rewrite_bullet":
        line_id = (given.get("evidence_ids") or ["?"])[0]
        if decision == "rewritten":
            title, detail = f"Rewrote line {line_id} as {out['bullet_id']}", out["text"]
        elif decision == "keep original":
            kind, title = "ok", f"Kept line {line_id} exactly as you wrote it"
            detail = "It already fits the job. Nothing to verify."
        else:
            kind, title = "warn", f"No rewrite came back for line {line_id}"
    elif tool == "verify_claim":
        bullet_id = given.get("bullet_id", "")
        if out.get("passed"):
            kind, title = "ok", f"Verifier passed {bullet_id}"
            detail = "Every claim in it is in the lines it cites."
        else:
            kind, title = "bad", f"Verifier rejected {bullet_id}"
            detail = " ".join(out.get("violations", []))
    elif tool == "drop_bullet":
        kind, title = "warn", f"Dropped {given.get('bullet_id', '')}"
        detail = "Your original line stays."
    elif tool == "ask_user":
        title = "The agent had a question. Questions are not answered in this version."
        detail = given.get("question", "")
    elif tool == "assemble_resume":
        if decision == "assembled":
            kind, title = "ok", f"Assembled the resume with {out['bullets_used']} verified bullets"
        elif decision == "fallback":
            kind, title = "warn", "Out of steps: assembled in code from the verified bullets"
        else:
            kind, title = "warn", "Assembly check failed, trying again"
            detail = " ".join(out.get("problems", []))
    return {
        "n": step.step,
        "tool": tool,
        "kind": kind,
        "title": title,
        "detail": detail,
        "ms": step.latency_ms,
    }


def build_result(session: Session, header: list[str], seconds: float) -> dict[str, Any]:
    """Everything the review and output screens need. Still holds placeholders."""
    assert session.resume is not None  # run_agent always assembles before returning
    # Earlier failed checks per bullet, so the review can show "rejected once".
    rejections: dict[str, list[str]] = {}
    for step in session.trace:
        if step.tool == "verify_claim" and step.output.get("passed") is False:
            rejections.setdefault(step.input["bullet_id"], []).extend(
                step.output.get("violations", [])
            )
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
                                # The line before any rewrite, for the reject button.
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
                "attempts": session.attempts.get(bullet.replaces or "", 1),
                "rejections": rejections.get(bullet.id, []),
            }
            for bullet in session.bullets.values()
        ],
        # Every line a bullet can cite, by ID, for the citation markers.
        "evidence": {
            line.id: line.text
            for line in [*session.evidence.values(), *session.confirmed.values()]
        },
        "requirements": [
            {
                "id": req.id,
                "text": req.text,
                "priority": req.priority,
                # Covered by a rewritten bullet only while the visitor accepts it.
                "bullet_ids": [
                    b.id for b in session.bullets.values() if req.id in b.requirement_ids
                ],
                # Covered by an original line the writer chose not to change.
                "kept_line_ids": [
                    line_id
                    for line_id, req_ids in session.kept_original.items()
                    if req.id in req_ids
                ],
            }
            for req in session.requirements.values()
        ],
        "stats": {
            "seconds": round(seconds, 1),
            "steps": len(session.trace),
            "tokens_in": sum(step.tokens_in for step in session.trace),
            "tokens_out": sum(step.tokens_out for step in session.trace),
            # None when any step used a model with no known price.
            "cost_usd": None if None in costs else round(sum(costs), 5),
        },
    }
