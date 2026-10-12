"""Turn saved runs and scores into the numbers of EVAL_PLAN.md. No model is called.

Everything here is a small pure function over "rows": one dict per
(system, JD) with the facts the metrics need. report.py prints them.
"""

import math
import random
from collections import Counter
from collections.abc import Callable

from eval import config
from eval.data import Case, load_cases
from eval.schema import RunRecord
from eval.score import CoverageList, ScoreRecord, UnitScore, _coverage_path

RESAMPLES = 1000
SEED = 4  # fixed, so the intervals are the same on every run of the report


def claim_type(unit: UnitScore) -> str:
    """The type of an unsupported unit: the judge's if it flagged it, else S1's."""
    return unit.s2.type if not unit.s2.supported else unit.s1[0].type


def load_rows() -> dict[str, dict[str, dict]]:
    """system -> case_id -> row, for every output that has been scored."""
    cases = {c.id: c for c in load_cases()}
    rows: dict[str, dict[str, dict]] = {system: {} for system in config.SYSTEMS}
    for system in config.SYSTEMS:
        for path in sorted((config.SCORES_DIR / system).glob("*.json")):
            score = ScoreRecord.model_validate_json(path.read_text())
            run = RunRecord.model_validate_json((config.RUNS_DIR / system / path.name).read_text())
            case: Case = cases[score.case_id]
            bad = [u for u in score.units if u.unsupported]
            row = {
                "case": case,
                "score": score,
                "run": run,
                "units": len(score.units),
                "bad": len(bad),
                "bad_s1": sum(bool(u.s1) for u in score.units),
                "bad_s2": sum(not u.s2.supported for u in score.units),
                "types": Counter(claim_type(u) for u in bad),
                "numbers": (score.numbers_supported, score.numbers_total),
            }
            if case.kind == "real":
                coverage = CoverageList.model_validate_json(_coverage_path(case.id).read_text())
                supportable = [m.id for m in coverage.must_haves if m.supportable]
                row["supportable"] = len(supportable)
                row["addressed"] = len(set(score.addressed) & set(supportable))
                row["original_addressed"] = len(set(coverage.original_addressed) & set(supportable))
            rows[system][case.id] = row
    return rows


# --- per-JD values -----------------------------------------------------------------
# Each takes one row and returns (top, bottom) of a fraction. A metric over many
# JDs is sum(top) / sum(bottom), so the same code gives "share of resumes"
# (bottom is 1 per JD) and pooled ratios (bottom is the JD's own count).

Value = Callable[[dict], tuple[float, float]]

has_unsupported: Value = lambda row: (row["bad"] > 0, 1)  # metric 1, the headline
unsupported_share: Value = lambda row: (row["bad"], row["units"])  # metric 2
number_fidelity: Value = lambda row: row["numbers"]  # metric 4
coverage: Value = lambda row: (row["addressed"] / row["supportable"] if row["supportable"] else 0, bool(row["supportable"]))  # metric 5: mean of per-JD coverage
original_coverage: Value = lambda row: (row["original_addressed"] / row["supportable"] if row["supportable"] else 0, bool(row["supportable"]))


def ratio(rows: list[dict], value: Value) -> float | None:
    top = sum(value(row)[0] for row in rows)
    bottom = sum(value(row)[1] for row in rows)
    return top / bottom if bottom else None  # None: nothing to divide by


def bootstrap(by_case: dict[str, dict], value: Value) -> tuple[float | None, float | None]:
    """95% interval of a metric, by resampling JDs with replacement."""
    rng = random.Random(SEED)
    ids = sorted(by_case)
    results = []
    for _ in range(RESAMPLES):
        # A resample is as many JDs as there are, drawn with repeats. JDs are
        # the unit because lines within one resume are not independent.
        sample = [by_case[rng.choice(ids)] for _ in ids]
        result = ratio(sample, value)
        if result is not None:
            results.append(result)
    results.sort()
    if not results:
        return None, None
    # The 2.5th and 97.5th percentiles of the resampled values.
    return results[int(0.025 * len(results))], results[int(0.975 * len(results)) - 1]


def paired_difference(a: dict[str, dict], b: dict[str, dict], value: Value) -> tuple[float, float, float]:
    """Metric 11: (a - b) and its 95% interval, resampling the SAME JDs for both.

    Paired means each resample uses one list of JDs for both systems. A hard JD
    is then hard for both, and only the difference between systems is left.
    """
    rng = random.Random(SEED)
    ids = sorted(set(a) & set(b))
    differences = []
    for _ in range(RESAMPLES):
        sample = [rng.choice(ids) for _ in ids]
        differences.append(
            (ratio([a[i] for i in sample], value) or 0) - (ratio([b[i] for i in sample], value) or 0)
        )
    differences.sort()
    point = (ratio([a[i] for i in ids], value) or 0) - (ratio([b[i] for i in ids], value) or 0)
    return point, differences[int(0.025 * RESAMPLES)], differences[int(0.975 * RESAMPLES) - 1]


def percentile(values: list[float], p: float) -> float:
    """The p-th percentile by the nearest-rank rule (p50 of 30 values is the 15th)."""
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * p / 100) - 1)]


# --- judge against human --------------------------------------------------------------


def agreement(pairs: list[tuple[bool, bool]]) -> tuple[float, float | None]:
    """Percent agreement and Cohen's kappa for (judge says supported, human says supported)."""
    n = len(pairs)
    observed = sum(judge == human for judge, human in pairs) / n
    # Chance agreement: how often two raters with these yes-rates would agree
    # if each answered at random. Kappa is the agreement beyond that chance.
    judge_yes = sum(judge for judge, _ in pairs) / n
    human_yes = sum(human for _, human in pairs) / n
    chance = judge_yes * human_yes + (1 - judge_yes) * (1 - human_yes)
    kappa = None if chance == 1 else (observed - chance) / (1 - chance)  # undefined if no variation
    return observed, kappa
