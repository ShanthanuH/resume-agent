"""assemble_resume: put the chosen bullets back into the resume and check the result.

All plain code. The agent chooses which bullets go in; this module builds the
resume from that choice and refuses the result if a check fails.
"""

from pydantic import BaseModel

from resume_agent.extract import Link
from resume_agent.models import Entry, EvidenceLine, TailoredBullet
from resume_agent.parsing import normalize

# Jake's Resume order (spec section 6). A section is placed by the first keyword
# its heading contains; sections matching none keep their original order after these.
SECTION_ORDER = ["education", "experience", "project", "skill"]

# How much longer than the original the tailored resume may be, in characters.
# The original fits one page, so staying near its length keeps the page count.
# This is an estimate: the true check is rendering the PDF (Rung 5).
PAGE_SLACK = 1.02


class ResumeLine(BaseModel):
    text: str
    evidence_id: str  # the original line this position belongs to
    bullet_id: str | None = None  # set when a tailored bullet replaced the original


class ResumeEntry(BaseModel):
    entry: Entry
    lines: list[ResumeLine]


class ResumeSection(BaseModel):
    name: str
    entries: list[ResumeEntry]


class ResumeJson(BaseModel):
    sections: list[ResumeSection]
    links: list[Link]


def _section_rank(name: str) -> int:
    for rank, keyword in enumerate(SECTION_ORDER):
        if keyword in name.lower():
            return rank
    return len(SECTION_ORDER)  # unknown sections go after the known ones


def build_resume(
    evidence: list[EvidenceLine], bullets: list[TailoredBullet], links: list[Link]
) -> ResumeJson:
    """Rebuild the resume line by line, swapping in the chosen bullets."""
    replacement = {b.replaces: b for b in bullets}  # original line id -> new bullet
    sections: list[ResumeSection] = []
    for line in evidence:  # evidence is in the resume's original order
        # Start a new section or entry whenever the heading changes.
        if not sections or sections[-1].name != line.section:
            sections.append(ResumeSection(name=line.section, entries=[]))
        entries = sections[-1].entries
        if not entries or entries[-1].entry != line.entry:
            entries.append(ResumeEntry(entry=line.entry, lines=[]))
        bullet = replacement.get(line.id)
        entries[-1].lines.append(
            ResumeLine(
                text=bullet.text if bullet else line.text,
                evidence_id=line.id,
                bullet_id=bullet.id if bullet else None,
            )
        )
    # sorted() is stable: sections with the same rank keep their original order.
    sections = sorted(sections, key=lambda s: _section_rank(s.name))
    return ResumeJson(sections=sections, links=links)


def check_resume(
    resume: ResumeJson,
    evidence: list[EvidenceLine],
    bullets: list[TailoredBullet],
    links: list[Link],
) -> list[str]:
    """The final deterministic checks. Returns problems; an empty list means pass."""
    problems: list[str] = []
    lines = [l for s in resume.sections for e in s.entries for l in e.lines]

    # One page (estimated by length, see PAGE_SLACK).
    budget = int(sum(len(e.text) for e in evidence) * PAGE_SLACK)
    used = sum(len(l.text) for l in lines)
    if used > budget:
        problems.append(
            f"Over the one-page budget by {used - budget} characters. "
            "Leave out or shorten some bullets."
        )

    # All links present.
    kept_urls = {link.url for link in resume.links}
    for link in links:
        if link.url not in kept_urls:
            problems.append(f"The link {link.url} is missing.")

    # No duplicate claims: two bullets for one line, or the same text twice.
    targets = [b.replaces for b in bullets]
    for target in {t for t in targets if targets.count(t) > 1}:
        problems.append(f"More than one bullet replaces line {target}.")
    texts = [normalize(l.text).lower() for l in lines]
    for text in {t for t in texts if texts.count(t) > 1}:
        problems.append(f'The same line appears twice: "{text[:60]}"')

    # No section lost.
    kept_sections = {s.name for s in resume.sections}
    for name in dict.fromkeys(e.section for e in evidence):  # unique, in order
        if name not in kept_sections:
            problems.append(f"The section {name} is missing.")

    # Every chosen bullet must land somewhere.
    placed = {l.bullet_id for l in lines}
    for bullet in bullets:
        if bullet.id not in placed:
            problems.append(f"Bullet {bullet.id} has no line to replace.")
    return problems
