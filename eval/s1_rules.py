"""S1, the rules scorer. Plain code, no model, so it cannot favour any provider.

Spec A5: every number, percentage, year, duration, job title and employer name
in a scored unit must appear somewhere in the WHOLE original resume.

Written from scratch for the eval. It imports nothing from the agent's verifier
(resume_agent.verify): a scorer that shares code with the thing it scores would
share its blind spots too.
"""

import re
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from eval.units import Unit, norm

FlagType = Literal["new_skill", "inflated_scope", "changed_number", "new_title", "other"]


class Flag(BaseModel):
    """One unsupported claim found in one unit."""

    type: FlagType
    claim: str  # the words at fault, as written in the unit
    reason: str


# --- numbers, percentages, years ---------------------------------------------

_WORDS = {
    "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13,
    "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90, "hundred": 100,
    "thousand": 1000, "million": 10**6, "billion": 10**9,
}  # fmt: skip
# "one" is left out on purpose: it is nearly always a pronoun ("one of the
# first"), so counting it as the number 1 would flag honest sentences.
_SCALE = {"k": 10**3, "m": 10**6, "b": 10**9, "thousand": 10**3, "lakh": 10**5,
          "million": 10**6, "crore": 10**7, "billion": 10**9}  # fmt: skip
_PERCENT = r"(?P<pct>\s?(?:%|percent\b|per\s+cent\b))?"

_DIGITS = re.compile(
    r"(?<![A-Za-z0-9.])"  # not glued to a letter: the 5 in "PyQt5" is a name
    r"(?P<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)"  # 1,015 or 0.89 or 2024
    r"(?P<scale>\s?(?:thousand|lakh|million|crore|billion)\b|[kKmMbB]\b)?"  # 10k, 2 million
    r"(?:st|nd|rd|th)?"  # "1st" is the number 1
    + _PERCENT
    + r"(?![A-Za-z0-9])"  # nothing glued on after it: the 180 in "180MB" still
    # counts because of the unit rule below, but "3D" does not
)
# A number glued to a unit ("650MB", "120ms", "2x") is still a number claim.
_GLUED_UNIT = re.compile(r"(?<![A-Za-z0-9.])(?P<num>\d+(?:\.\d+)?)(?:x|ms|s|mb|gb|tb|kb|hz|fps)\b", re.I)
_WORD_NUMBER = re.compile(
    r"\b(?P<word>" + "|".join(_WORDS) + r")(?:-(?P<unit>" + "|".join(_WORDS) + r"))?\b"
    + _PERCENT,
    re.IGNORECASE,
)

Number = tuple[Decimal, bool, str]  # (value, is a percentage, the text as written)


def numbers(text: str) -> list[Number]:
    """Every number in text in one normal form: "40 percent" == "40%", "three" == 3.

    Decimal, not float, so that 0.89 == 0.890 exactly and no rounding creeps in.
    """
    found: list[Number] = []
    for match in _DIGITS.finditer(text):
        value = Decimal(match["num"].replace(",", ""))
        if match["scale"]:
            value *= _SCALE[match["scale"].strip().lower()]
        found.append((value, bool(match["pct"]), match[0].strip()))
    for match in _GLUED_UNIT.finditer(text):
        found.append((Decimal(match["num"]), False, match[0]))
    for match in _WORD_NUMBER.finditer(text):
        value = Decimal(_WORDS[match["word"].lower()])
        if match["unit"]:  # "twenty-five" is 20 + 5
            value += _WORDS[match["unit"].lower()]
        found.append((value, bool(match["pct"]), match[0].strip()))
    return found


def number_supported(number: Number, original: list[Number]) -> bool:
    value, is_percent, _ = number
    if is_percent:
        # A percentage must be a percentage in the resume too: "40%" is not
        # backed by "40 ms".
        return any(v == value and p for v, p, _ in original)
    return any(v == value for v, _, _ in original)


def _check_numbers(unit: str, original: str) -> list[Flag]:
    known = numbers(original)
    return [
        Flag(type="changed_number", claim=n[2], reason="number not in the original resume")
        for n in numbers(unit)
        if not number_supported(n, known)
    ]


# --- durations -----------------------------------------------------------------

_UNITS = {"year": "year", "yr": "year", "month": "month", "week": "week", "day": "day",
          "hour": "hour", "hr": "hour"}  # fmt: skip
_DURATION = re.compile(
    r"(?<![A-Za-z0-9.])(?P<num>\d+(?:\.\d+)?|" + "|".join(_WORDS) + r")\+?[\s-]?"
    r"(?P<unit>" + "|".join(_UNITS) + r")s?\b",
    re.IGNORECASE,
)


def _durations(text: str) -> dict[tuple[Decimal, str], str]:
    """Every duration as (amount, unit) -> the text as written. "3 yrs" == "three years"."""
    found: dict[tuple[Decimal, str], str] = {}
    for match in _DURATION.finditer(text):
        raw = match["num"].lower()
        amount = Decimal(_WORDS[raw]) if raw in _WORDS else Decimal(raw)
        found[amount, _UNITS[match["unit"].lower()]] = match[0]
    return found


def _check_durations(unit: str, original: str) -> list[Flag]:
    # The number alone is not enough here: "3 years" is not backed by a resume
    # that only says "3 projects". The amount and the unit must appear together.
    known = _durations(original)
    return [
        Flag(type="changed_number", claim=text, reason="duration not in the original resume")
        for key, text in _durations(unit).items()
        if key not in known
    ]


# --- job titles and seniority ----------------------------------------------------

# Words that claim a role or a level. Only unambiguous ones: a false flag here
# would count a whole resume as "has an unsupported claim". Plurals are not
# matched, so "worked with engineers" is not a title claim.
_TITLE_WORDS = [
    "senior", "sr", "junior", "jr", "chief", "director", "manager", "founder",
    "cofounder", "co-founder", "cto", "ceo", "vp", "president", "architect",
    "intern", "trainee", "engineer", "developer", "programmer", "scientist",
    "analyst", "researcher", "consultant", "administrator", "supervisor",
    "coordinator", "captain", "freelancer",
]  # fmt: skip
_ROLE = r"(?:engineer|developer|scientist|architect|designer|analyst|researcher)"
# Words that are a title only in a certain shape. "lead" is usually a verb,
# "principal" and "staff" are usually not about rank ("principal component").
_TITLE_SHAPES = (
    r"(?:team|tech|technical|project|engineering|product)\s+lead"
    rf"|(?:lead|staff|principal|associate)\s+(?:[a-z/]+\s+)?{_ROLE}"
    r"|head\s+of"
)
_TITLE = re.compile(
    r"(?<![a-z0-9-])(?:" + _TITLE_SHAPES + "|" + "|".join(_TITLE_WORDS) + r")(?![a-z0-9-])"
)


def _check_titles(unit: str, original: str) -> list[Flag]:
    known = set(_TITLE.findall(norm(original)))
    # dict.fromkeys drops repeats and keeps the order of first appearance.
    return [
        Flag(type="new_title", claim=word, reason="title word not in the original resume")
        for word in dict.fromkeys(_TITLE.findall(norm(unit)))
        if word not in known
    ]


# --- employer names --------------------------------------------------------------

# Code cannot know which words are a company. It can only catch the places a
# new employer usually appears: the organization field of an entry header, and
# shapes like "at Google", "client: Acme", "Acme Labs" inside a line. Any other
# new name is left to the S2 judge.
_NAME = r"[A-Z][\w&.'-]*(?:\s+(?:[A-Z][\w&.'-]*|of|and|&))*"  # "Tata Motors", "Bank of India"
_COMPANY_ENDINGS = "Inc|Ltd|LLC|Corp|Corporation|Technologies|Labs|Pvt|GmbH"
_EMPLOYER_SHAPES = [
    re.compile(rf"(?:\bat|@|\bjoined|\bclient:?|\bclients\s+(?:like|such\s+as|including))\s+({_NAME})"),
    re.compile(rf"\b({_NAME}\s+(?:{_COMPANY_ENDINGS}))\b"),
]
# Words that say nothing about WHICH employer it is.
_GENERIC = {"the", "and", "for", "inc", "ltd", "llc", "corp", "corporation", "pvt",
            "gmbh", "technologies", "labs", "university", "institute", "company",
            "services", "solutions", "systems", "group", "india", "limited"}  # fmt: skip


def _is_new_name(name: str, original_words: set[str]) -> bool:
    """True if no telling word of the name is in the resume.

    Deliberately lenient: "IIT Kharagpur" for "Indian Institute of Technology
    Kharagpur" shares "kharagpur", so it is not flagged. Only a name with no
    overlap at all ("Google") is. A short form is a rewording, not a new employer.
    """
    words = [w for w in re.findall(r"[a-z0-9]+", norm(name)) if len(w) >= 3 and w not in _GENERIC]
    return bool(words) and not any(w in original_words for w in words)


def _check_employers(unit: Unit, original: str) -> list[Flag]:
    if unit.kind == "organization":
        names = [unit.text]  # the whole field is the employer name
    else:
        names = [m for shape in _EMPLOYER_SHAPES for m in shape.findall(unit.text)]
    original_words = set(re.findall(r"[a-z0-9]+", norm(original)))
    return [
        Flag(type="other", claim=name, reason="employer name not in the original resume")
        for name in dict.fromkeys(names)
        if _is_new_name(name, original_words)
    ]


# --- all rules -------------------------------------------------------------------


def score_unit(unit: Unit, original_text: str) -> list[Flag]:
    """Every S1 flag for one unit. An empty list means S1 found nothing."""
    durations = _check_durations(unit.text, original_text)
    # A duration is also a number, so "5 years" would be flagged twice. The
    # duration flag wins: drop a number flag that is the start of a duration.
    numbers_only = [
        flag
        for flag in _check_numbers(unit.text, original_text)
        if not any(d.claim.startswith(flag.claim) for d in durations)
    ]
    return (
        numbers_only
        + durations
        + _check_titles(unit.text, original_text)
        + _check_employers(unit, original_text)
    )


def number_fidelity(body: str, original_text: str) -> tuple[int, int]:
    """Metric 4: (numbers in the output that are in the original, numbers in the output)."""
    known = numbers(original_text)
    found = numbers(body)
    return sum(number_supported(n, known) for n in found), len(found)
