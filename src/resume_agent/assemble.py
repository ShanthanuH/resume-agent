"""assemble_resume: put the chosen bullets back into the resume and check the result.

All plain code. The agent chooses which bullets go in; this module builds the
resume from that choice and refuses the result if a check fails. Sections,
entries and lines stay in the resume's own order, under its own headings.

A bullet that cannot go in (its line is locked, it drops a link, it repeats a
line) is skipped: its line keeps the original text and the skip is logged. It
never fails the whole resume, because a failed assembly at the end of a run
falls back to no rewrites at all (Session.assemble_fallback).
"""

import logging
from collections import Counter

from pydantic import BaseModel

from resume_agent.extract import Link
from resume_agent.models import (
    LOCKED_KINDS,
    Entry,
    EvidenceLine,
    LineKind,
    Mark,
    TailoredBullet,
)
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
    # Bullets that could not go in, by ID, with the reason. Their lines kept
    # their original text.
    skipped: dict[str, str] = {}


def _blocked(line: EvidenceLine, bullet: TailoredBullet) -> str | None:
    """Why `bullet` cannot take the place of `line`, or None if it can."""
    if line.kind in LOCKED_KINDS:
        return "the line is printed as written"  # an entry header, or a fixed line
    _, lost = carry_marks(line.marks, bullet.text)
    if any(m.url for m in lost):
        return "it drops a link"
    return None


def _choose(evidence: list[EvidenceLine], bullets: list[TailoredBullet]) -> tuple[dict, dict]:
    """Which bullet replaces which line. Returns (line id -> bullet, bullet id -> why skipped)."""
    lines = {line.id: line for line in evidence}
    chosen: dict[str, TailoredBullet] = {}
    skipped: dict[str, str] = {}
    for bullet in bullets:
        line = lines.get(bullet.replaces or "")
        why = "it has no line to replace" if line is None else _blocked(line, bullet)
        if not why and line.id in chosen:
            why = "another bullet already replaces its line"
        if why:
            skipped[bullet.id] = why
        else:
            chosen[line.id] = bullet
    # A rewrite that reads the same as another line on the resume says the same
    # thing twice. The later one is skipped, until no line appears twice in a way
    # a rewrite caused. (Two original lines that read the same are the resume's own.)
    while True:
        final = {
            line.id: normalize(chosen[line.id].text if line.id in chosen else line.text).lower()
            for line in evidence
            if line.kind != "header"
        }
        counts = Counter(final.values())
        repeats = [i for i, text in final.items() if i in chosen and counts[text] > 1]
        if not repeats:
            return chosen, skipped
        skipped[chosen.pop(repeats[-1]).id] = "it repeats another line"


def build_resume(
    evidence: list[EvidenceLine], bullets: list[TailoredBullet], links: list[Link]
) -> ResumeJson:
    """Rebuild the resume line by line, swapping in the chosen bullets."""
    replacement, skipped = _choose(evidence, bullets)  # original line id -> new bullet
    for bullet_id, why in skipped.items():
        # IDs and fixed reasons only: resume text must not reach the log.
        log.warning("bullet %s skipped, its line keeps the original: %s", bullet_id, why)
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
    return ResumeJson(sections=sections, links=links, skipped=skipped)


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

    # No section lost.
    kept_sections = {s.name for s in resume.sections}
    for name in dict.fromkeys(e.section for e in evidence):  # unique, in order
        if name not in kept_sections:
            problems.append(f"The section {name} is missing.")

    # Every chosen bullet is on the resume, or was skipped by build_resume with a
    # reason. Two bullets for one line, or a repeated line, are skipped there.
    placed = {l.bullet_id for l in lines}
    for bullet in bullets:
        if bullet.id not in placed and bullet.id not in resume.skipped:
            problems.append(f"Bullet {bullet.id} was lost in assembly.")
    return problems
