"""Find the scored units: every line of a tailored resume that is new or changed.

Spec A5: unchanged lines are found by normalized exact match and count as
supported. Everything else is a unit that S1 and S2 must judge.

"Unchanged" is tested against the raw text of the original resume PDF, not
against the agent's own parse of it. So the test is the same for every system
and does not depend on the thing being scored.
"""

import re
import unicodedata
from typing import Literal

from pydantic import BaseModel

from eval.schema import TailoredResume


class Unit(BaseModel):
    """One thing to score."""

    # "line": a bullet or sentence. "skill": one skill from a skills row.
    # "title", "organization", "dates": one part of an entry header.
    kind: Literal["line", "skill", "title", "organization", "dates"]
    section: str
    text: str


# Characters that differ between a PDF and a model's retyping of it but carry
# no meaning: curly quotes, the different dashes, bullet symbols.
_SAME = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "•": " "})


def norm(text: str) -> str:
    """Lower-case, plain punctuation, single spaces, no bullet or final period."""
    # NFKC folds look-alike characters: a non-breaking space becomes a space,
    # the ligature "ﬁ" becomes "fi".
    text = unicodedata.normalize("NFKC", text).translate(_SAME).lower()
    text = re.sub(r"\s*-\s*", "-", text)  # "Feb 2026 - Present" == "Feb 2026-Present"
    return " ".join(text.split()).strip(" -*").rstrip(".")


def _in_original(text: str, original: str) -> bool:
    """True if text appears in the (already normalized) original as whole words."""
    needle = norm(text)
    if not needle:
        return True  # an empty field claims nothing
    # Without the two look-arounds "Java" would be found inside "JavaScript".
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", original))


def split_skills(row: str) -> list[str]:
    """Split a skills row into single skills: "ML: PyTorch, NumPy" -> 2 items."""
    # Drop the row's label. Only a short label counts, so a colon deep inside a
    # sentence is left alone.
    label, colon, rest = row.partition(":")
    if colon and len(label) <= 40:
        row = rest
    # Split on commas and semicolons, but not inside brackets:
    # "retrieval evaluation (recall@k, precision@k)" is one skill.
    items = re.split(r"[,;](?![^()]*\))", row)
    return [item.strip() for item in items if item.strip()]


def scored_units(output: TailoredResume, original_text: str) -> list[Unit]:
    """Every new or changed line, added skill and changed entry header."""
    original = norm(original_text)
    units: list[Unit] = []
    for section in output.sections:
        is_skills = "skill" in section.name.lower()
        for entry in section.entries:
            # An entry header is a claim too (a title, an employer, dates). Each
            # of its three parts is scored by itself if it is not in the original.
            header = {"title": entry.title, "organization": entry.organization, "dates": entry.dates}
            for kind, part in header.items():
                if not _in_original(part, original):
                    units.append(Unit(kind=kind, section=section.name, text=part))
            for line in entry.lines:
                if _in_original(line, original):
                    continue  # unchanged: counts as supported, never scored
                if not is_skills:
                    units.append(Unit(kind="line", section=section.name, text=line))
                    continue
                # A changed skills row is scored skill by skill (spec: "each
                # added skill"), so one new skill is one unit, not a whole row.
                for skill in split_skills(line):
                    if not _in_original(skill, original):
                        units.append(Unit(kind="skill", section=section.name, text=skill))
    return units
