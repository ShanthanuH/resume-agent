"""assemble_resume: put the chosen bullets back into the resume and check the result.

All plain code. The agent chooses which bullets go in; this module builds the
resume from that choice and refuses the result if a check fails. Sections,
entries and lines stay in the resume's own order, under its own headings.
"""

import logging

from pydantic import BaseModel

from resume_agent.extract import Link
from resume_agent.models import LOCKED_KINDS, Entry, EvidenceLine, LineKind, Mark, TailoredBullet
from resume_agent.parsing import normalize
from resume_agent.structure import carry_marks

log = logging.getLogger(__name__)

# How much longer than the original the tailored resume may be, in characters.
# The original fits one page, so staying near its length keeps the page count.
# This is an estimate: the true check is rendering the PDF (Rung 5).
PAGE_SLACK = 1.02


class ResumeLine(BaseModel):
    text: str
    evidence_id: str  # the original line this position belongs to
    bullet_id: str | None = None  # set when a tailored bullet replaced the original
    kind: LineKind = "bullet"
    join: bool = False  # continues the paragraph of the line before it
    marks: list[Mark] = []  # bold, italic and links inside `text`


class ResumeEntry(BaseModel):
    entry: Entry
    lines: list[ResumeLine]


class ResumeSection(BaseModel):
    name: str
    entries: list[ResumeEntry]


class ResumeJson(BaseModel):
    sections: list[ResumeSection]
    links: list[Link]


def _blocked(line: EvidenceLine, bullet: TailoredBullet) -> str | None:
    """Why `bullet` cannot take the place of `line`, or None if it can."""
    if line.kind in LOCKED_KINDS:
        return (
            f"Line {line.id} is printed as written (an entry header or a line kept "
            f"as is), so bullet {bullet.id} cannot replace it. Leave {bullet.id} out."
        )
    _, lost = carry_marks(line.marks, bullet.text)
    links = [m for m in lost if m.url]
    if links:
        return (
            f'Bullet {bullet.id} drops the link on "{links[0].text}", so line '
            f"{line.id} keeps its original text. Leave {bullet.id} out."
        )
    return None


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
        if line.kind == "header":
            continue  # drawn as part of the entry header, from header_lines
        bullet = replacement.get(line.id)
        if bullet and _blocked(line, bullet):
            # The original stays, and check_resume tells the agent why. IDs
            # only in the log: resume text must not reach it.
            log.warning("bullet %s kept off line %s", bullet.id, line.id)
            bullet = None
        entries[-1].lines.append(
            ResumeLine(
                text=bullet.text if bullet else line.text,
                evidence_id=line.id,
                bullet_id=bullet.id if bullet else None,
                kind=line.kind,
                join=line.join,
                # Bold, italic and links move onto the new words by position.
                marks=carry_marks(line.marks, bullet.text)[0] if bullet else line.marks,
            )
        )
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

    # One page (estimated by length, see PAGE_SLACK). Header lines are printed
    # from the entry header either way, so they do not count.
    budget = int(sum(len(e.text) for e in evidence if e.kind != "header") * PAGE_SLACK)
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

    # No duplicate claims: two bullets for one line, or a bullet repeating a line.
    targets = [b.replaces for b in bullets]
    for target in {t for t in targets if targets.count(t) > 1}:
        problems.append(f"More than one bullet replaces line {target}.")
    texts = [normalize(l.text).lower() for l in lines]
    new = {normalize(l.text).lower() for l in lines if l.bullet_id}
    # Two original lines that read the same are the resume's own; only a
    # rewrite that repeats a line is a problem.
    for text in {t for t in texts if texts.count(t) > 1 and t in new}:
        problems.append(f'The same line appears twice: "{text[:60]}"')

    # No section lost.
    kept_sections = {s.name for s in resume.sections}
    for name in dict.fromkeys(e.section for e in evidence):  # unique, in order
        if name not in kept_sections:
            problems.append(f"The section {name} is missing.")

    # Every chosen bullet must land somewhere.
    by_id = {e.id: e for e in evidence}
    placed = {l.bullet_id for l in lines}
    for bullet in bullets:
        if bullet.id in placed:
            continue
        line = by_id.get(bullet.replaces or "")
        problem = _blocked(line, bullet) if line else None
        problems.append(problem or f"Bullet {bullet.id} has no line to replace.")
    return problems
