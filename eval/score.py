"""Score every saved output. Run: uv run python -m eval.score

Per output: the scored units, S1 flags and S2 verdicts for each, number
fidelity, canary hits (adversarial JDs) and coverage (real JDs). Scores are
saved one file per output, so scoring is resumable like the runs are.

The judge is Claude on a flat subscription, so calls go one at a time with a
pause in between, and scoring stops cleanly when the usage limit is hit.
"""

from pathlib import Path

from pydantic import BaseModel

from eval import config, s1_rules, s2_judge, store
from eval.claude_cli import UsageLimit
from eval.data import Case, canary_hits, load_cases, load_resume
from eval.gemini import Usage
from eval.s1_rules import Flag
from eval.s2_judge import MustHave, Verdict
from eval.schema import RunRecord, body_text
from eval.units import Unit, scored_units


class UnitScore(BaseModel):
    unit: Unit
    s1: list[Flag]  # empty means S1 found nothing
    s2: Verdict

    @property
    def unsupported(self) -> bool:
        """Spec: a line is unsupported if S1 OR S2 flags it."""
        return bool(self.s1) or not self.s2.supported


class ScoreRecord(BaseModel):
    system: str
    case_id: str
    run: int
    units: list[UnitScore]  # one per new or changed line; unchanged lines are not here
    numbers_supported: int  # metric 4: numbers in the output that are in the original
    numbers_total: int
    canary_hits: list[str] = []  # adversarial JDs only
    addressed: list[str] = []  # real JDs only: supportable must-have IDs addressed
    judge_model: str = ""  # the exact model that judged, as the CLI reports it
    judge_tokens_in: int = 0  # no money figure: the judge runs on a flat subscription
    judge_tokens_out: int = 0


class CoverageList(BaseModel):
    """The must-haves of one real JD. Made once; every system is scored against it."""

    case_id: str
    judge_model: str
    must_haves: list[MustHave]
    original_addressed: list[str]  # the reference: what the untailored resume addresses
    tokens_in: int
    tokens_out: int


def _coverage_path(case_id: str) -> Path:
    return config.CACHE_DIR / "coverage" / f"{case_id}.json"


def make_coverage_list(case: Case) -> CoverageList:
    """Extract the must-haves of one JD and score the original resume on them."""
    original = load_resume(case.resume_id).text
    must_haves, usage = s2_judge.extract_must_haves(case.jd_text, original)
    # The original resume goes through the same coverage call as every system's
    # output, so the reference is measured the same way as what it is compared to.
    addressed, usage2 = s2_judge.judge_coverage(must_haves, original)
    used = [u for u in (usage, usage2) if u]
    return CoverageList(
        case_id=case.id,
        judge_model=usage.version,
        must_haves=must_haves,
        original_addressed=addressed,
        tokens_in=sum(u.tokens_in for u in used),
        tokens_out=sum(u.tokens_out for u in used),
    )


def score_output(record: RunRecord, case: Case) -> ScoreRecord:
    """All scores for one saved output."""
    original = load_resume(case.resume_id).text
    body = body_text(record.output)
    units = scored_units(record.output, original)
    verdicts, usage = s2_judge.judge_units(units, original)  # S2: one call per output
    used: list[Usage] = [usage] if usage else []
    score = ScoreRecord(
        system=record.system,
        case_id=record.case_id,
        run=record.run,
        units=[
            UnitScore(unit=unit, s1=s1_rules.score_unit(unit, original), s2=verdict)
            for unit, verdict in zip(units, verdicts)
        ],
        numbers_supported=0,
        numbers_total=0,
    )
    score.numbers_supported, score.numbers_total = s1_rules.number_fidelity(body, original)
    if case.kind == "adversarial":
        score.canary_hits = canary_hits(case.canaries, body)  # the gap report is not in body
    else:
        coverage = CoverageList.model_validate_json(_coverage_path(case.id).read_text())
        score.addressed, usage = s2_judge.judge_coverage(coverage.must_haves, body)
        used += [usage] if usage else []
    score.judge_model = used[0].version if used else ""
    score.judge_tokens_in = sum(u.tokens_in for u in used)
    score.judge_tokens_out = sum(u.tokens_out for u in used)
    return score


def _run_and_save(jobs: dict[Path, tuple], work) -> int:
    """Run work(*args) for every job, one at a time, and save each result.

    Returns how many jobs are still unsaved. A job that fails stays unsaved, so
    the next start tries it again.
    """
    for done, (target, args) in enumerate(jobs.items(), start=1):
        name = f"{target.parent.name}/{target.stem}"
        try:
            store.save(target, work(*args))
        except UsageLimit as err:
            # Nothing more can run until the limit resets. Everything done so
            # far is saved; starting the scorer again carries on from here.
            print(f"USAGE LIMIT at {name}: {err}\nStopped. Run the same command again later.")
            return len(jobs) - done + 1
        except Exception as err:  # noqa: BLE001
            print(f"[{done}/{len(jobs)}] FAILED {name}: {err}", flush=True)
            continue
        print(f"[{done}/{len(jobs)}] scored {name}", flush=True)
    return sum(not target.exists() for target in jobs)


def score_all() -> int:
    """Score every saved output that has no score yet. Returns how many are left."""
    cases = {case.id: case for case in load_cases()}
    # Only the systems of this eval: older folders (the A0 smoke runs) are ignored.
    outputs = sorted(p for s in config.SYSTEMS for p in (config.RUNS_DIR / s).glob("*.json"))
    records = [RunRecord.model_validate_json(p.read_text()) for p in outputs]

    # Step 1: one must-have list per real JD, before any output is scored, so
    # every output of a JD is scored against the same list.
    needed = {r.case_id for r in records if cases[r.case_id].kind == "real"}
    lists = {
        _coverage_path(case_id): (cases[case_id],)
        for case_id in sorted(needed)
        if not _coverage_path(case_id).exists()
    }
    left = _run_and_save(lists, make_coverage_list)
    if left:
        return left  # outputs cannot be scored without their list

    # Step 2: the outputs.
    todo = {
        store.path(config.SCORES_DIR, r.system, r.case_id, r.run): (r, cases[r.case_id])
        for r in records
        if not store.path(config.SCORES_DIR, r.system, r.case_id, r.run).exists()
    }
    print(f"{len(todo)} outputs to score, {len(records) - len(todo)} already scored", flush=True)
    return _run_and_save(todo, score_output)


if __name__ == "__main__":
    raise SystemExit(1 if score_all() else 0)
