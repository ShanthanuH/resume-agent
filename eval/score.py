"""Score every saved output. Run: uv run --env-file .env python -m eval.score

Per output: the scored units, S1 flags and S2 verdicts for each, number
fidelity, canary hits (adversarial JDs) and coverage (real JDs). Scores are
saved one file per output, so scoring is resumable like the runs are.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from pydantic import BaseModel

from eval import config, s1_rules, s2_judge, store
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
    judge_tokens_in: int = 0
    judge_tokens_out: int = 0
    judge_cost: float = 0.0


class CoverageList(BaseModel):
    """The must-haves of one real JD. Made once; every system is scored against it."""

    case_id: str
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
    score.judge_tokens_in = sum(u.tokens_in for u in used)
    score.judge_tokens_out = sum(u.tokens_out for u in used)
    score.judge_cost = sum(config.cost(u.model, u.tokens_in, u.tokens_out) or 0 for u in used)
    return score


def _run_and_save(jobs: dict[Path, tuple], work, workers: int) -> int:
    """Run work(*args) for every job in threads and save each result. Returns failures."""
    failed = 0
    # Threads are fine here: these are plain model calls that keep no global state.
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(work, *args): target for target, args in jobs.items()}
        for done, future in enumerate(as_completed(futures), start=1):
            target = futures[future]
            try:
                store.save(target, future.result())
            except Exception as err:  # noqa: BLE001  stays unsaved, so it is retried next time
                failed += 1
                print(f"[{done}/{len(jobs)}] FAILED {target.parent.name}/{target.stem}: {err}")
                continue
            print(f"[{done}/{len(jobs)}] scored {target.parent.name}/{target.stem}")
    return failed


def score_all(workers: int) -> int:
    """Score every saved output that has no score yet. Returns how many failed."""
    cases = {case.id: case for case in load_cases()}
    outputs = sorted(config.RUNS_DIR.glob("*/*.json"))
    records = [RunRecord.model_validate_json(p.read_text()) for p in outputs]

    # Step 1: one must-have list per real JD, before any output is scored, so
    # every output of a JD is scored against the same list.
    needed = {r.case_id for r in records if cases[r.case_id].kind == "real"}
    lists = {
        _coverage_path(case_id): (cases[case_id],)
        for case_id in sorted(needed)
        if not _coverage_path(case_id).exists()
    }
    failed = _run_and_save(lists, make_coverage_list, workers)
    if failed:
        return failed  # outputs cannot be scored without their list

    # Step 2: the outputs.
    todo = {
        store.path(config.SCORES_DIR, r.system, r.case_id, r.run): (r, cases[r.case_id])
        for r in records
        if not store.path(config.SCORES_DIR, r.system, r.case_id, r.run).exists()
    }
    print(f"{len(todo)} outputs to score, {len(records) - len(todo)} already scored")
    return _run_and_save(todo, score_output, workers)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Score the saved eval outputs.")
    parser.add_argument("--workers", type=int, default=config.WORKERS)
    raise SystemExit(1 if score_all(parser.parse_args().workers) else 0)
