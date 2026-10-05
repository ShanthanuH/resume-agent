"""verify_claim: is everything in a new bullet backed by its cited source lines?

Two layers (spec section 5):
- Layer 1, rules: plain code, no model. Checks numbers, tools, names and titles.
  It is strict and cheap, and it never lets a model talk it into anything.
- Layer 2, judge: one model call. Checks the claims that code cannot recognise,
  such as "demonstrated strong ownership".

A bullet goes to the judge only after it passes the rules.
"""

import re
from decimal import Decimal
from functools import lru_cache
from importlib import resources

from pydantic import BaseModel

from resume_agent import llm
from resume_agent.models import EvidenceLine, TailoredBullet, Verification
from resume_agent.tools import format_evidence

# ---------------------------------------------------------------------------
# What a bullet is checked against
# ---------------------------------------------------------------------------


def _source_text(sources: list[EvidenceLine]) -> str:
    """Everything a bullet may draw on: each cited line plus its entry header."""
    parts: list[str] = []
    for line in sources:
        entry = line.entry
        parts += [line.text, line.section, entry.title, entry.organization, entry.dates]
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Check 1: numbers, percentages, years
# ---------------------------------------------------------------------------

# One number, with an optional size word and an optional percent sign.
# re.VERBOSE lets the pattern be laid out over several commented lines.
_NUMBER = re.compile(
    r"""
    (?P<num>\d+(?:,\d{3})+(?:\.\d+)?     # 1,015 or 2,000,000.5 (comma groups)
          |\d+(?:\.\d+)?)                # or 40, 0.89, 2024
    (?P<scale>\s?(?:thousand|million|billion|lakh|crore)\b
          |[kKmMbB](?![A-Za-z]))?        # 10k, 2M. Not the M in "650MB"
    (?P<pct>\s?(?:%|percent\b|per\s+cent\b))?
    """,
    re.VERBOSE | re.IGNORECASE,
)

_SCALES = {
    "k": 10**3,
    "thousand": 10**3,
    "lakh": 10**5,
    "m": 10**6,
    "million": 10**6,
    "crore": 10**7,
    "b": 10**9,
    "billion": 10**9,
}


def _numbers(text: str) -> set[tuple[Decimal, bool]]:
    """Every number in text as (value, is_percent), in one normal form.

    "40 percent" and "40%" both become (40, True). "2M" and "2,000,000" both
    become (2000000, False). Decimal is used, not float, so 0.1 stays exactly 0.1.
    """
    found: set[tuple[Decimal, bool]] = set()
    for match in _NUMBER.finditer(text):
        value = Decimal(match["num"].replace(",", ""))
        if match["scale"]:
            value *= _SCALES[match["scale"].strip().lower()]
        found.add((value, bool(match["pct"])))
    return found


def _check_numbers(bullet: str, source: str) -> list[str]:
    bullet, source = _mask_skills(bullet), _mask_skills(source)
    in_source = _numbers(source)
    values_in_source = {value for value, _ in in_source}
    violations: list[str] = []
    # Walk the bullet's own matches (not the set) so the message can quote the
    # number exactly as the writer wrote it.
    for match in _NUMBER.finditer(bullet):
        value = Decimal(match["num"].replace(",", ""))
        if match["scale"]:
            value *= _SCALES[match["scale"].strip().lower()]
        if match["pct"]:
            # A percentage must be a percentage in the source too: "40%" is not
            # backed by "40 ms".
            supported = (value, True) in in_source
        else:
            supported = value in values_in_source
        if not supported:
            violations.append(
                f'The number "{match[0].strip()}" is not in the source lines.'
            )
    return violations


# ---------------------------------------------------------------------------
# Check 2: tools and technologies, against the skill list
# ---------------------------------------------------------------------------

# A skill name must not be glued to these characters on either side, so "Java"
# is not found inside "JavaScript" and "C" is not found inside "C++" or "R&D".
_GLUE = r"A-Za-z0-9+#&"


def _alias_pattern(alias: str) -> re.Pattern[str]:
    exact_case = alias.startswith("=")  # the "=" marker from skills.txt
    alias = alias.lstrip("=")
    # One- and two-letter names ("R", "JS") are always matched with exact capitals.
    flags = 0 if exact_case or len(alias) <= 2 else re.IGNORECASE
    plural = "s?" if alias.isupper() else ""  # "APIs" still counts as "API"
    return re.compile(
        rf"(?<![{_GLUE}]){re.escape(alias)}{plural}(?![{_GLUE}])", flags
    )


@lru_cache  # read and compile the list once
def _skills() -> list[tuple[str, list[re.Pattern[str]]]]:
    """The skill list as (display name, one pattern per spelling)."""
    raw = resources.files("resume_agent").joinpath("skills.txt").read_text()
    skills = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        aliases = [a.strip() for a in line.split(" | ")]
        skills.append((aliases[0].lstrip("="), [_alias_pattern(a) for a in aliases]))
    return skills


def _check_skills(bullet: str, source: str) -> list[str]:
    violations: list[str] = []
    for name, patterns in _skills():
        in_bullet = any(p.search(bullet) for p in patterns)
        # Any spelling in the source backs any spelling in the bullet.
        if in_bullet and not any(p.search(source) for p in patterns):
            violations.append(f'The tool "{name}" is not in the source lines.')
    return violations


def _mask_skills(text: str) -> str:
    """Replace every skill name in text with "_".

    The skill check has already judged those words, so the other checks should
    not look at them again: the 8 in "K8s" is not a number claim, and "Google
    Cloud" is not the organization "Google".
    """
    for _, patterns in _skills():
        for pattern in patterns:
            text = pattern.sub(" _ ", text)
    return text


# ---------------------------------------------------------------------------
# Check 3: names (organizations, products, tools the skill list does not know)
# ---------------------------------------------------------------------------

_SEPARATORS = re.compile(r"[\s/|–—-]+")  # spaces, slashes, bars, hyphens, dashes
_EDGE_PUNCTUATION = ".,;:()[]{}\"'“”‘’!?*•"


def _words(text: str) -> list[str]:
    """Split text into bare words: "(BM25-based," gives "BM25" and "based"."""
    words: list[str] = []
    for raw in _SEPARATORS.split(text):
        word = raw.strip(_EDGE_PUNCTUATION)
        if word.endswith(("'s", "’s")):  # "Acme's" -> "Acme"
            word = word[:-2]
        if len(word) > 2 and word.endswith("s") and word[:-1].isupper():
            word = word[:-1]  # "LLMs" -> "LLM"
        if word:
            words.append(word)
    return words


def _check_names(bullet: str, source: str) -> list[str]:
    """Flag capitalised words that the source does not contain.

    Resume bullets are written in lower case apart from the first word, so a
    capital letter in the middle of a bullet marks a name: a company, a product,
    a tool, a month. Every such name has to come from the source.
    """
    source_words = {w.lower() for w in _words(source)}
    violations: list[str] = []
    # Skill names are masked out of the bullet: the skill check owns those.
    for position, word in enumerate(_words(_mask_skills(bullet))):
        if position == 0:  # the first word is capitalised because it starts the line
            continue
        if not any(c.isupper() for c in word):
            continue
        if _NUMBER.fullmatch(word):  # "5M" is a number; the number check owns it
            continue
        if _TITLE.fullmatch(word):  # "Senior" is a title; the title check owns it
            continue
        if word.lower() not in source_words:
            violations.append(f'The name "{word}" is not in the source lines.')
    # dict.fromkeys drops repeats when the same name appears twice in a bullet.
    return list(dict.fromkeys(violations))


# ---------------------------------------------------------------------------
# Check 4: job titles and seniority
# ---------------------------------------------------------------------------

# Words that claim a role or a level. Chosen to be unambiguous: "lead" alone is
# left out because it is usually a verb, and plurals ("engineers") do not match.
_TITLE_WORDS = [
    "senior", "junior", "principal", "staff engineer", "manager", "director",
    "founder", "co-founder", "cofounder", "intern", "engineer", "developer",
    "scientist", "analyst", "architect", "researcher", "consultant", "president",
    "captain", "officer", "supervisor", "coordinator", "specialist",
    "administrator", "leader", "team lead", "tech lead", "technical lead",
    "head of", "vice president", "chief",
]  # fmt: skip
# Longest first, so "co-founder" is tried before "founder".
_TITLE = re.compile(
    r"\b(" + "|".join(sorted(map(re.escape, _TITLE_WORDS), key=len, reverse=True))
    + r")\b",
    re.IGNORECASE,
)


def _check_titles(bullet: str, source: str) -> list[str]:
    in_source = {m.lower() for m in _TITLE.findall(source)}
    violations = [
        f'The title word "{found}" is not in the source lines.'
        for found in _TITLE.findall(bullet)
        if found.lower() not in in_source
    ]
    return list(dict.fromkeys(violations))


# ---------------------------------------------------------------------------
# Layer 1
# ---------------------------------------------------------------------------


def verify_rules(bullet: TailoredBullet, sources: list[EvidenceLine]) -> Verification:
    """Layer 1. Pure code: the same input always gives the same answer."""
    source = _source_text(sources)
    violations = (
        _check_numbers(bullet.text, source)
        + _check_skills(bullet.text, source)
        + _check_names(bullet.text, source)
        + _check_titles(bullet.text, source)
    )
    return Verification(passed=not violations, violations=violations, layer="rules")


# ---------------------------------------------------------------------------
# Layer 2
# ---------------------------------------------------------------------------


class _VerdictDraft(BaseModel):
    bullet_id: str  # echoed back by the model so code can pair the answer
    unsupported_claims: list[str]


class _VerdictBatchDraft(BaseModel):
    verdicts: list[_VerdictDraft]


JUDGE_SYSTEM = """You check rewritten resume bullets against their source rows.
You get several checks. Each has an id, a bullet, and the source rows
(id | section | title | organization | dates | text) that the bullet must be based on.
For each check, list every claim in the bullet that the source rows do not support.
Not supported means the bullet says something the sources do not:
- a result, impact, scale, purpose or audience that is not stated
- a tool, method, role, seniority or responsibility that is not stated
- a soft skill or quality presented as fact ("demonstrated ownership")
- a stronger verb than the source justifies ("led" when the source says "part of")
Supported, so do NOT list it:
- rewording, reordering, shortening, or leaving facts out
- naming the obvious category of something the source describes
  ("machine learning" for a neural-network classifier)
Rules:
- Judge only against the given rows. Do not use outside knowledge of the candidate.
- Each unsupported claim is one short sentence quoting the words at fault.
- A fully supported bullet gets an empty list. An empty list is a correct answer.
- Return one verdict for every check id you were given."""

Check = tuple[TailoredBullet, list[EvidenceLine]]  # a bullet and its source lines


def judge_bullets(checks: list[Check]) -> dict[str, Verification]:
    """Layer 2 for many bullets in one model call. Returns bullet id -> result."""
    if not checks:
        return {}
    draft = llm.generate_structured(
        model=llm.CHEAP_MODEL,
        system=JUDGE_SYSTEM,
        user="\n".join(
            f'<check id="{bullet.id}">\n'
            + llm.wrap_untrusted("bullet", bullet.text)
            + "\n"
            + llm.wrap_untrusted("evidence", format_evidence(sources))
            + "\n</check>"
            for bullet, sources in checks
        ),
        schema=_VerdictBatchDraft,
    )
    answers = {v.bullet_id: v for v in draft.verdicts}
    results: dict[str, Verification] = {}
    for bullet, _ in checks:
        answer = answers.get(bullet.id)
        if answer is None:
            # Fail closed: a bullet the judge skipped has not been checked, so it
            # must not count as passed.
            results[bullet.id] = Verification(
                passed=False,
                violations=["The judge returned no verdict for this bullet."],
                layer="judge",
            )
            continue
        claims = [c.strip() for c in answer.unsupported_claims if c.strip()]
        results[bullet.id] = Verification(
            passed=not claims, violations=claims, layer="judge"
        )
    return results


# ---------------------------------------------------------------------------
# Both layers
# ---------------------------------------------------------------------------


def verify_claims(checks: list[Check]) -> dict[str, Verification]:
    """Run the rules on every bullet, then the judge on those that passed."""
    results = {bullet.id: verify_rules(bullet, sources) for bullet, sources in checks}
    # No point paying for a model call on a bullet the rules already rejected.
    survivors = [(b, s) for b, s in checks if results[b.id].passed]
    results.update(judge_bullets(survivors))
    return results


def verify_claim(bullet: TailoredBullet, sources: list[EvidenceLine]) -> Verification:
    """The verify_claim tool: both layers for one bullet."""
    return verify_claims([(bullet, sources)])[bullet.id]
