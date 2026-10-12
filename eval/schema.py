"""The one output shape every system returns, so every system is scored the same way.

It is the agent's resume JSON (sections -> entries -> lines) without the
agent's internal IDs. The baselines cannot know evidence or bullet IDs, and the
scorers must not use them: they only ever read text.
"""

from pydantic import BaseModel

from resume_agent.assemble import ResumeJson


class OutEntry(BaseModel):
    """One job, project or degree, with the lines under it."""

    title: str  # "" when the entry has none, e.g. a skills block
    organization: str
    dates: str
    lines: list[str]  # one string per bullet, summary sentence or skills row


class OutSection(BaseModel):
    name: str
    entries: list[OutEntry]


class TailoredResume(BaseModel):
    sections: list[OutSection]


class RunRecord(BaseModel):
    """Everything saved for one (system, case, run). One JSON file each."""

    system: str
    case_id: str
    run: int
    output: TailoredResume
    tokens_in: int
    tokens_out: int
    cost: float | None  # US dollars at API list price; None if a price is unknown
    latency_s: float
    models: dict[str, list[int]]  # model name -> [calls, tokens in, tokens out]
    tries: int = 1  # how many times the case was started before it finished
    # Agent systems (A0, A1) only:
    trace: list[dict] = []  # every step of the agent, as logged by the agent itself
    requirements: list[dict] = []  # the agent's own requirement list with final status
    gaps: list[str] = []  # the gap report: requirement texts with no evidence


def from_agent(resume: ResumeJson) -> TailoredResume:
    """Drop the agent's IDs and links; keep the text exactly as assembled."""
    return TailoredResume(
        sections=[
            OutSection(
                name=section.name,
                entries=[
                    OutEntry(
                        title=entry.entry.title,
                        organization=entry.entry.organization,
                        dates=entry.entry.dates,
                        lines=[line.text for line in entry.lines],
                    )
                    for entry in section.entries
                ],
            )
            for section in resume.sections
        ]
    )


def body_text(resume: TailoredResume) -> str:
    """The whole resume as plain text: headings, entry headers and lines.

    This is the "resume body" that canaries are searched in and that coverage
    is judged on. The gap report is not part of it.
    """
    parts: list[str] = []
    for section in resume.sections:
        parts.append(section.name.upper())
        for entry in section.entries:
            header = " | ".join(p for p in (entry.title, entry.organization, entry.dates) if p)
            if header:
                parts.append(header)
            parts += [f"- {line}" for line in entry.lines]
    return "\n".join(parts)
