"""search_evidence and rewrite_bullet. The model writes words; code does bookkeeping.

Each tool has a batch form (many items, one model call) and a single form that is
just a batch of one. Batching keeps a whole resume to a handful of model calls.
"""

from pydantic import BaseModel

from resume_agent import llm
from resume_agent.models import EvidenceLine, Requirement, TailoredBullet

# Most evidence lines one requirement can cite. A few strong lines beat a long
# list: with many sources the writer blends facts that do not belong together.
MAX_MATCHES = 3


class _MatchDraft(BaseModel):
    requirement_id: str  # echoed back by the model so code can pair the answer
    evidence_ids: list[str]


class _MatchBatchDraft(BaseModel):
    matches: list[_MatchDraft]


class _BulletDraft(BaseModel):
    bullet_id: str  # echoed back by the model; the ID itself was made in code
    text: str
    replaces: str | None  # the model may suggest which original line this replaces


class _BulletBatchDraft(BaseModel):
    bullets: list[_BulletDraft]


class RewriteJob(BaseModel):
    """One bullet to write: its code-assigned ID, its sources and its targets."""

    bullet_id: str
    sources: list[EvidenceLine]
    requirements: list[Requirement]
    violations: list[str] = []  # filled only on a retry after a failed verification


def _format_evidence(lines: list[EvidenceLine]) -> str:
    """One line per EvidenceLine: id, where it comes from, then the text."""
    return "\n".join(
        f"{e.id} | {e.section} | {e.entry.title} | {e.entry.organization} | "
        f"{e.entry.dates} | {e.text}"
        for e in lines
    )


SEARCH_SYSTEM = f"""You match job requirements to resume evidence.
Each evidence row is: id | section | title | organization | dates | text.
Each requirement row is: id | text.
For every requirement, return the ids of the rows that directly show the candidate
meets it.
Rules:
- Only return a row if it clearly demonstrates the requirement as written.
- Do not stretch. A related but different skill is not a match.
- Return at most {MAX_MATCHES} rows per requirement, strongest first. Prefer a row
  that describes real work over a row that only lists the skill.
- If no row matches, return an empty list. An empty list is a correct answer.
- Return one entry for every requirement id you were given."""

REWRITE_SYSTEM = """You rewrite resume bullets to fit a job description.
You get several jobs. Each job has an id, source rows
(id | section | title | organization | dates | text) and the requirements to target.
Write ONE resume bullet per job and return it with that job's id.
Rules:
- Use only facts found in that job's own source rows. Never add a number, tool,
  language, title, organization, scope or result that is not there. Never borrow
  a fact from another job.
- A requirement is something to emphasise, not something to claim. Name a tool or
  language from a requirement only if the source row itself names it.
- Keep every number, metric and named tool that the source row has.
- Never state a soft skill ("demonstrated ownership", "strong problem-solving").
  Let the facts show it.
- Make the targeted requirements easy to spot: lead with the part of the row they
  care about, cut detail that does not serve them, and use a requirement's own
  term where the row clearly describes the same thing.
- Return the row unchanged only when no such edit would help.
- One line, starts with a verb in the same tense as the source row (usually past
  tense: "Built", not "Build"), no first person, no trailing period.
- If a source row is a list and not a sentence (a skills or tools row), return its
  text unchanged.
- replaces: the id of the one source row this bullet is a rewrite of, or null if
  it combines several rows.
- If a job lists violations, the previous attempt broke those rules. Fix them."""


def search_all_evidence(
    requirements: list[Requirement], evidence: list[EvidenceLine]
) -> dict[str, list[str]]:
    """Match every requirement in one model call. Returns requirement id -> IDs."""
    draft = llm.generate_structured(
        model=llm.CHEAP_MODEL,
        system=SEARCH_SYSTEM,
        user=(
            llm.wrap_untrusted(
                "requirement", "\n".join(f"{r.id} | {r.text}" for r in requirements)
            )
            + "\n"
            + llm.wrap_untrusted("evidence", _format_evidence(evidence))
        ),
        schema=_MatchBatchDraft,
    )
    known = {e.id for e in evidence}
    # Start every requirement at "no evidence". A requirement the model forgot
    # then counts as a gap, which is the safe direction.
    result: dict[str, list[str]] = {r.id: [] for r in requirements}
    for match in draft.matches:
        if match.requirement_id not in result:  # an ID the model made up
            continue
        # dict.fromkeys removes duplicates and keeps order. The filter drops any
        # evidence ID the model made up, so callers only ever see real IDs.
        ids = [i for i in dict.fromkeys(match.evidence_ids) if i in known]
        result[match.requirement_id] = ids[:MAX_MATCHES]
    return result


def search_evidence(
    requirement: Requirement, evidence: list[EvidenceLine]
) -> list[str]:
    """Return the IDs of evidence lines that support one requirement."""
    return search_all_evidence([requirement], evidence)[requirement.id]


def _format_job(job: RewriteJob) -> str:
    text = (
        f'<job id="{job.bullet_id}">\n'
        + llm.wrap_untrusted("evidence", _format_evidence(job.sources))
        + "\n"
        + llm.wrap_untrusted("requirement", "\n".join(r.text for r in job.requirements))
    )
    if job.violations:
        text += "\nViolations in the previous attempt:\n" + "\n".join(
            f"- {v}" for v in job.violations
        )
    return text + "\n</job>"


def rewrite_bullets(jobs: list[RewriteJob]) -> list[TailoredBullet]:
    """Write one bullet per job in a single model call."""
    for job in jobs:
        if not job.sources:  # no evidence means no bullet; the caller records a gap
            raise ValueError(f"job {job.bullet_id} has no source lines")
    draft = llm.generate_structured(
        model=llm.STRONG_MODEL,
        system=REWRITE_SYSTEM,
        user="\n".join(_format_job(job) for job in jobs),
        schema=_BulletBatchDraft,
    )
    # Pair answers to jobs by ID. Later duplicates overwrite earlier ones, and an
    # answer with an unknown ID is simply never looked up.
    by_id = {b.bullet_id: b for b in draft.bullets}
    bullets: list[TailoredBullet] = []
    for job in jobs:  # loop over OUR jobs, so the model cannot add extra bullets
        answer = by_id.get(job.bullet_id)
        if answer is None or not answer.text.strip():
            continue  # the model skipped this job; the caller sees it is missing
        source_ids = [e.id for e in job.sources]
        bullets.append(
            TailoredBullet(
                id=job.bullet_id,
                text=" ".join(answer.text.split()),  # collapse stray newlines
                source_ids=source_ids,  # from the job, not from the model
                requirement_ids=[r.id for r in job.requirements],
                # Keep the model's pick only if it is one of the lines it was given.
                replaces=answer.replaces if answer.replaces in source_ids else None,
            )
        )
    return bullets


def rewrite_bullet(
    sources: list[EvidenceLine],
    requirements: list[Requirement],
    bullet_id: str,
    violations: list[str] | None = None,
) -> TailoredBullet:
    """Write one tailored bullet. Used for retries, where one bullet is redone."""
    job = RewriteJob(
        bullet_id=bullet_id,
        sources=sources,
        requirements=requirements,
        violations=violations or [],
    )
    bullets = rewrite_bullets([job])
    if not bullets:
        raise ValueError(f"the model returned no bullet for {bullet_id}")
    return bullets[0]
