"""parse_resume and parse_jd.

The resume is split by code (structure.py), from the PDF's layout: every line
is copied as printed, so it is verbatim by construction. The JD is read by the
model; the code checks it and assigns IDs.
"""

import logging
from typing import Literal

from pydantic import BaseModel

from resume_agent import llm
from resume_agent.models import Entry, EvidenceLine, Requirement
from resume_agent.structure import ParsedResume, parse_layout

log = logging.getLogger(__name__)


# "Draft" models are what the model is allowed to return. They have no id field,
# so the model cannot assign IDs even if it tries.
class _RequirementDraft(BaseModel):
    text: str
    priority: Literal["must_have", "nice_to_have"]


class _JDDraft(BaseModel):
    requirements: list[_RequirementDraft]


def normalize(text: str) -> str:
    """Collapse every run of whitespace to one space."""
    # split() with no arguments splits on any whitespace, including newlines,
    # so a bullet wrapped over two PDF lines compares equal to the joined bullet.
    return " ".join(text.split())


def is_verbatim(snippet: str, source: str) -> bool:
    """True if snippet appears in source, ignoring whitespace differences."""
    return normalize(snippet) in normalize(source)


JD_SYSTEM = """You extract requirements from a job description.
Rules:
- One requirement is one single skill, tool, qualification or type of experience.
- Split compound requirements: "Python and FastAPI" becomes two requirements.
- priority is nice_to_have only when the JD clearly says so (preferred, bonus,
  nice to have, a plus). In every other case it is must_have.
- Skip company description, benefits and anything that is not asked of the candidate."""


def evidence_lines(parsed: ParsedResume) -> list[EvidenceLine]:
    """Every line of the parsed resume as an EvidenceLine, with IDs in order.

    Bullets, rows and summary sentences can be rewritten. An entry with no
    lines under it (a degree, say) still needs the matcher to see it, so each
    of its header lines becomes a "header" line, which is never rewritten. A
    section with nothing in it keeps its heading the same way. Assembly
    rebuilds the resume from these lines alone, so every entry needs one.
    """
    lines: list[EvidenceLine] = []

    def add(section: str, entry: Entry, text: str, **fields) -> None:
        lines.append(
            EvidenceLine(
                id=f"E{len(lines) + 1}",  # numbered in resume order, set in code
                section=section,
                entry=entry,
                text=text,
                **fields,
            )
        )

    for section in parsed.sections:
        for parsed_entry in section.entries:
            entry = parsed_entry.entry
            for item in parsed_entry.items:
                add(section.heading, entry, item.text.text, kind=item.kind,
                    join=item.join, marks=item.text.marks)
            if not parsed_entry.items:
                for header in entry.header_lines:
                    if header.left.text:
                        add(section.heading, entry, header.left.text, kind="header")
        if not section.entries:  # a heading with nothing under it
            add(section.heading, Entry(), section.heading, kind="header")
    return lines


def parse_resume(text: str) -> list[EvidenceLine]:
    """Split the resume into verbatim EvidenceLines with code-assigned IDs.

    `text` is a ResumeText when it came from a PDF (it carries the layout), or
    plain pasted text. No model is called.
    """
    return evidence_lines(parse_layout(text))


def parse_jd(text: str) -> list[Requirement]:
    """Split the JD into single requirements with code-assigned IDs."""
    draft = llm.generate_structured(
        model=llm.CHEAP_MODEL,
        system=JD_SYSTEM,
        user=llm.wrap_untrusted("jd", text),
        schema=_JDDraft,
    )
    return [
        # enumerate(..., start=1) gives R1, R2, ... in the order the JD lists them.
        Requirement(id=f"R{n}", text=normalize(item.text), priority=item.priority)
        for n, item in enumerate(draft.requirements, start=1)
        if item.text.strip()
    ]
