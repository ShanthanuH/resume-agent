"""parse_resume and parse_jd. The model reads; the code checks and assigns IDs."""

import logging
from typing import Literal

from pydantic import BaseModel

from resume_agent import llm
from resume_agent.models import Entry, EvidenceLine, Requirement

log = logging.getLogger(__name__)


# "Draft" models are what the model is allowed to return. They have no id field,
# so the model cannot assign IDs even if it tries.
class _EntryDraft(BaseModel):
    title: str
    organization: str
    dates: str


class _LineDraft(BaseModel):
    section: str
    entry: _EntryDraft
    text: str


class _ResumeDraft(BaseModel):
    lines: list[_LineDraft]


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


RESUME_SYSTEM = """You split a resume into evidence lines.
Return one line per bullet point or standalone fact (a degree, a skills row).
Rules:
- A bullet that wraps over several lines in the resume is ONE evidence line. Return
  the whole bullet, with the wrapped parts joined by a single space. Never return
  half a sentence.
- text: copy the characters exactly from the resume. Do not fix typos, reword,
  shorten or merge. Leave out only the leading bullet symbol.
- section: the section heading the line sits under, copied exactly.
- entry: the job, project or degree the line belongs to. title, organization and
  dates are copied exactly from the resume. Use an empty string for any that is absent.
- Skip the name and contact details at the top."""

JD_SYSTEM = """You extract requirements from a job description.
Rules:
- One requirement is one single skill, tool, qualification or type of experience.
- Split compound requirements: "Python and FastAPI" becomes two requirements.
- priority is nice_to_have only when the JD clearly says so (preferred, bonus,
  nice to have, a plus). In every other case it is must_have.
- Skip company description, benefits and anything that is not asked of the candidate."""


def parse_resume(text: str) -> list[EvidenceLine]:
    """Split the resume into verbatim EvidenceLines with code-assigned IDs."""
    draft = llm.generate_structured(
        model=llm.CHEAP_MODEL,
        system=RESUME_SYSTEM,
        user=llm.wrap_untrusted("resume", text),
        schema=_ResumeDraft,
    )
    lines: list[EvidenceLine] = []
    for item in draft.lines:
        # The core guarantee: a line the model reworded or invented never gets in.
        if not item.text.strip() or not is_verbatim(item.text, text):
            log.warning("dropped non-verbatim line: %r", item.text)
            continue
        entry = Entry(
            # Entry fields feed the verifier later, so they get the same check.
            # A field that fails is blanked rather than trusted.
            title=item.entry.title if is_verbatim(item.entry.title, text) else "",
            organization=(
                item.entry.organization
                if is_verbatim(item.entry.organization, text)
                else ""
            ),
            dates=item.entry.dates if is_verbatim(item.entry.dates, text) else "",
        )
        lines.append(
            EvidenceLine(
                id=f"E{len(lines) + 1}",  # numbered by kept lines, so no gaps
                section=item.section,
                entry=entry,
                text=normalize(item.text),
            )
        )
    return lines


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
