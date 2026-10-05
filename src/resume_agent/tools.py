"""search_evidence and rewrite_bullet. The model writes words; code does bookkeeping."""

from pydantic import BaseModel

from resume_agent import llm
from resume_agent.models import EvidenceLine, Requirement, TailoredBullet


class _MatchDraft(BaseModel):
    evidence_ids: list[str]


class _BulletDraft(BaseModel):
    text: str
    replaces: str | None  # the model may suggest which original line this replaces


def _format_evidence(lines: list[EvidenceLine]) -> str:
    """One line per EvidenceLine: id, where it comes from, then the text."""
    return "\n".join(
        f"{e.id} | {e.section} | {e.entry.title} | {e.entry.organization} | "
        f"{e.entry.dates} | {e.text}"
        for e in lines
    )


SEARCH_SYSTEM = """You match one job requirement to resume evidence.
Each evidence row is: id | section | title | organization | dates | text.
Return the ids of rows that directly show the candidate meets the requirement.
Rules:
- Only return a row if it clearly demonstrates the requirement as written.
- Do not stretch. A related but different skill is not a match.
- If no row matches, return an empty list. An empty list is a correct answer."""

REWRITE_SYSTEM = """You rewrite resume bullets to fit a job description.
You get source rows (id | section | title | organization | dates | text) and the
requirements to target. Write ONE resume bullet.
Rules:
- Use only facts found in the source rows. Never add a number, tool, title,
  organization, scope or result that is not there.
- You may reorder, tighten and change emphasis so the targeted requirements stand out.
- One line, starts with a strong verb, no first person, no trailing period.
- replaces: the id of the one source row this bullet is a rewrite of, or null if
  it combines several rows.
- If a list of violations is given, the previous attempt broke those rules. Fix them."""


def search_evidence(
    requirement: Requirement, evidence: list[EvidenceLine]
) -> list[str]:
    """Return the IDs of evidence lines that support the requirement."""
    draft = llm.generate_structured(
        model=llm.CHEAP_MODEL,
        system=SEARCH_SYSTEM,
        user=(
            llm.wrap_untrusted("requirement", requirement.text)
            + "\n"
            + llm.wrap_untrusted("evidence", _format_evidence(evidence))
        ),
        schema=_MatchDraft,
    )
    known = {e.id for e in evidence}
    # dict.fromkeys removes duplicates and keeps order. The filter drops any ID
    # the model made up, so callers only ever see real EvidenceLine IDs.
    return [i for i in dict.fromkeys(draft.evidence_ids) if i in known]


def rewrite_bullet(
    sources: list[EvidenceLine],
    requirements: list[Requirement],
    bullet_id: str,
    violations: list[str] | None = None,
) -> TailoredBullet:
    """Write one tailored bullet from the given sources."""
    if not sources:  # no evidence means no bullet; the caller records a gap instead
        raise ValueError("rewrite_bullet needs at least one source line")
    user = (
        llm.wrap_untrusted("evidence", _format_evidence(sources))
        + "\n"
        + llm.wrap_untrusted("requirement", "\n".join(r.text for r in requirements))
    )
    if violations:  # only present on a retry, after a failed verification
        user += "\nViolations in the previous attempt:\n" + "\n".join(
            f"- {v}" for v in violations
        )
    draft = llm.generate_structured(
        model=llm.STRONG_MODEL,
        system=REWRITE_SYSTEM,
        user=user,
        schema=_BulletDraft,
    )
    source_ids = [e.id for e in sources]
    return TailoredBullet(
        id=bullet_id,
        text=" ".join(draft.text.split()),  # collapse stray newlines from the model
        source_ids=source_ids,  # from the arguments, not from the model
        requirement_ids=[r.id for r in requirements],
        # Keep the model's pick only if it is one of the lines it was given.
        replaces=draft.replaces if draft.replaces in source_ids else None,
    )
