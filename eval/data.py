"""Load the eval data: 3 resumes and 40 JD files. No model is called here."""

import re
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from resume_agent.extract import ExtractedResume, extract_resume_pdf

DATA = Path(__file__).parent / "data"  # gitignored: resumes are personal data
ATTACKS = ["injection", "missing_skill", "number_bait", "title_bait", "near_miss"]


class Case(BaseModel):
    """One JD paired with one resume. This is the unit every system is run on."""

    id: str  # the file name without ".txt", e.g. "R2_05_squareyards"
    kind: Literal["real", "adversarial"]
    resume_id: str  # "R1", "R2" or "R3"
    fit: str = ""  # real JDs only: "good" or "stretch"
    attack: str = ""  # adversarial JDs only: one of ATTACKS
    canaries: list[str] = []  # adversarial only: strings that must not appear
    header: dict[str, str]  # every header field, including ones we do not use
    jd_text: str  # the body only. Systems never see the header.


def parse_jd_file(path: Path, kind: Literal["real", "adversarial"]) -> Case:
    """Split a JD file into its header fields and its body."""
    # partition splits at the FIRST "---" line, so a "---" inside the JD body
    # stays in the body.
    head, separator, body = path.read_text().partition("\n---\n")
    if not separator:
        raise ValueError(f"{path.name}: no '---' line between header and body")
    header: dict[str, str] = {}
    for line in head.splitlines():
        key, colon, value = line.partition(":")  # only the first colon: URLs have more
        if not colon:
            raise ValueError(f"{path.name}: header line without a colon: {line!r}")
        header[key.strip()] = value.strip()
    return Case(
        id=path.stem,
        kind=kind,
        resume_id=header.get("resume", ""),
        fit=header.get("fit", ""),
        attack=header.get("attack", ""),
        # Canaries are comma-separated, so a canary can never contain a comma.
        canaries=[c.strip() for c in header.get("canary", "").split(",") if c.strip()],
        header=header,
        jd_text=body.strip(),
    )


def load_cases() -> list[Case]:
    """All 40 cases, real ones first, each group sorted by file name."""
    cases: list[Case] = []
    for kind in ("real", "adversarial"):
        for path in sorted((DATA / "jds" / kind).glob("*.txt")):
            cases.append(parse_jd_file(path, kind))
    return cases


@lru_cache  # PDF extraction is slow and every case of a resume needs the same text
def load_resume(resume_id: str) -> ExtractedResume:
    return extract_resume_pdf(DATA / "resumes" / f"{resume_id}.pdf")


def canary_pattern(canary: str) -> re.Pattern[str]:
    """Whole-word, case-insensitive match for one canary string."""
    # Any run of spaces in the canary matches any whitespace, so a canary that
    # wraps over two lines of a resume is still found.
    words = r"\s+".join(re.escape(word) for word in canary.split())
    # \b does not work for canaries that end in a symbol ("40%", "5+ years"),
    # so "whole word" is written out: no letter or digit right before or after.
    return re.compile(rf"(?<![A-Za-z0-9]){words}(?![A-Za-z0-9])", re.IGNORECASE)


def canary_hits(canaries: list[str], text: str) -> list[str]:
    """The canaries that appear in text."""
    return [c for c in canaries if canary_pattern(c).search(text)]
