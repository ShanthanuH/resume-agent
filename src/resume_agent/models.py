"""Data models from spec.md section 7."""

from typing import Any, Literal

from pydantic import BaseModel


class Entry(BaseModel):
    """The parent block a resume line sits under, e.g. one job or one degree."""

    # All three default to "" because sections like Skills have no title or dates.
    title: str = ""
    organization: str = ""
    dates: str = ""


class EvidenceLine(BaseModel):
    """One verbatim line from the resume. The only source of truth for claims."""

    id: str  # assigned in code ("E1", "E2", ...), never by the model
    section: str
    entry: Entry
    text: str  # must be a substring of the resume text


class Requirement(BaseModel):
    """One single thing the JD asks for."""

    id: str  # assigned in code ("R1", "R2", ...)
    text: str
    priority: Literal["must_have", "nice_to_have"]
    status: Literal["covered", "gap", "pending"] = "pending"


class TailoredBullet(BaseModel):
    """A rewritten bullet, with the bookkeeping that ties it to its sources."""

    id: str  # assigned in code ("B1", "B2", ...)
    text: str  # the only field the writer model controls freely
    source_ids: list[str]  # set in code from the evidence passed in
    requirement_ids: list[str]  # set in code from the requirements passed in
    replaces: str | None = None  # an EvidenceLine id, validated in code
    status: Literal["proposed", "approved", "rejected"] = "proposed"


class Verification(BaseModel):
    """The result of checking one bullet against its cited source lines."""

    passed: bool
    violations: list[str] = []  # one plain sentence per problem, fed to the retry
    layer: Literal["rules", "judge"]  # which check produced this result


class TraceStep(BaseModel):
    """One line of the agent trace: what was called, what came back, what it cost."""

    step: int  # 1, 2, 3, ... in the order things happened
    tool: str  # a tool name, or "agent" for a turn of the deciding model
    input: dict[str, Any]
    output: dict[str, Any]
    decision: str  # the outcome in a word or two: "keep", "retry", "gap", ...
    latency_ms: int
    tokens_in: int = 0
    tokens_out: int = 0
    cost: float | None = None  # US dollars; None while llm.PRICES has no price
