"""Write eval/RESULTS.md and the charts. Run: uv run python -m eval.report

Reads the saved runs, the scores and (if labelled) eval/labels/sheet.csv.
No model is called. Failure examples are taken from R1 runs only (spec A6):
R2 and R3 belong to other people, so they appear only as aggregate numbers.
"""

import csv
from collections import Counter

import matplotlib

matplotlib.use("Agg")  # draw to files; no window is needed
import matplotlib.pyplot as plt

from eval import config, metrics
from eval.data import ATTACKS
from eval.metrics import Value
from eval.sheet import LABELS

NAMES = {"B1": "B1 naive prompt", "B2": "B2 careful prompt", "A1": "A1 agent"}
TYPES = ["new_skill", "inflated_scope", "changed_number", "new_title", "other"]
CHARTS = config.ROOT / "charts"
KAPPA_FLOOR = 0.6  # EVAL_PLAN.md: below this, review disagreements before reporting


def pct(value: float | None) -> str:
    return "n/a" if value is None else f"{100 * value:.0f}%"


def with_interval(by_case: dict[str, dict], value: Value) -> str:
    """"40% (12 of 30) [23%, 57%]": the value, its counts and its 95% interval."""
    rows = list(by_case.values())
    top = sum(value(r)[0] for r in rows)
    bottom = sum(value(r)[1] for r in rows)
    low, high = metrics.bootstrap(by_case, value)
    # Coverage is a mean of per-JD fractions, so its "top" is not a whole count.
    counts = f"{top:.0f} of {bottom:.0f}" if float(top).is_integer() else f"mean of {bottom:.0f} JDs"
    return f"{pct(metrics.ratio(rows, value))} ({counts}) [{pct(low)}, {pct(high)}]"


def table(header: list[str], body: list[list[str]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(str(cell) for cell in row) + " |" for row in body]
    return "\n".join(lines) + "\n"


def subset(by_case: dict[str, dict], keep) -> dict[str, dict]:
    return {case_id: row for case_id, row in by_case.items() if keep(row["case"])}


# --- judge against my labels -----------------------------------------------------------


def load_labels(rows: dict) -> list[dict]:
    """Labelled sheet rows joined to the judge's verdict through key.csv."""
    sheet, key = LABELS / "sheet.csv", LABELS / "key.csv"
    if not sheet.exists() or not key.exists():
        return []
    keys = {row["row_id"]: row for row in csv.DictReader(key.open())}
    labelled = []
    for row in csv.DictReader(sheet.open()):
        answer = row["supported (Y/N)"].strip().upper()
        if answer not in ("Y", "N"):
            continue  # not labelled yet
        where = keys[row["row_id"]]
        unit = rows[where["system"]][where["case_id"]]["score"].units[int(where["unit"])]
        labelled.append(
            {
                "row_id": row["row_id"],
                "system": where["system"],
                "resume_id": row["resume_id"],
                "line": row["line"],
                "human": answer == "Y",
                "s2": unit.s2.supported,
                "either": not unit.unsupported,  # supported by S1 and S2 together
                "judge_claim": unit.s2.claim,
                "human_claim": row["claim"],
            }
        )
    return labelled


def agreement_section(labelled: list[dict]) -> str:
    if not labelled:
        return "Not measured yet: `eval/labels/sheet.csv` has no labels.\n"
    body = []
    for name, group in [("All", labelled)] + [
        (NAMES[s], [x for x in labelled if x["system"] == s]) for s in config.SYSTEMS
    ]:
        if not group:
            continue
        s2_agree, s2_kappa = metrics.agreement([(x["s2"], x["human"]) for x in group])
        both_agree, both_kappa = metrics.agreement([(x["either"], x["human"]) for x in group])
        kappa = lambda k: "n/a" if k is None else f"{k:.2f}"  # noqa: E731
        body.append(
            [name, len(group), f"{sum(not x['human'] for x in group)}", pct(s2_agree), kappa(s2_kappa), pct(both_agree), kappa(both_kappa)]
        )
    text = table(
        ["Rows", "n", "I marked unsupported", "S2 agreement", "S2 kappa", "S1 or S2 agreement", "S1 or S2 kappa"],
        body,
    )
    text += "\nKappa is n/a when the judge or I gave the same answer on every row of a group.\n"
    # False negatives matter most: lines I marked unsupported that the scorers passed.
    missed = sum(not x["human"] and x["either"] for x in labelled)
    wrongly = sum(x["human"] and not x["either"] for x in labelled)
    text += (
        f"\nOf {sum(not x['human'] for x in labelled)} lines I marked unsupported, the scorers "
        f"(S1 or S2) missed {missed}. Of {sum(x['human'] for x in labelled)} lines I marked "
        f"supported, they flagged {wrongly}.\n"
    )
    return text


# --- agent path scores -------------------------------------------------------------------


def path_scores(agent_rows: dict[str, dict]) -> str:
    """What the agent's own trace shows, over every A1 run (real and adversarial)."""
    runs = len(agent_rows)
    searched_first = retries = canaries_seen = canaries_gapped = fallback = 0
    for row in agent_rows.values():
        trace = row["run"].trace
        searched: set[str] = set()
        ok = True
        targets: Counter = Counter()
        for step in trace:
            if step["tool"] == "search_evidence":
                searched.add(step["input"].get("requirement_id", ""))
            if step["tool"] == "rewrite_bullet" and step["decision"] != "refused":
                # Every requirement of a rewrite must have been searched before it.
                ok = ok and set(step["input"]["requirement_ids"]) <= searched
                targets[step["input"]["evidence_ids"][0]] += 1
            if step["tool"] == "assemble_resume" and step["decision"] == "fallback":
                fallback += 1
        searched_first += ok
        retries += sum(count - 1 for count in targets.values())  # rewrites after the first
        # A canary the agent's own requirement list mentions should end as a gap.
        for canary in row["case"].canaries:
            mentions = [r for r in row["run"].requirements if canary.lower() in r["text"].lower()]
            if mentions:
                canaries_seen += 1
                canaries_gapped += all(r["status"] == "gap" for r in mentions)
    injections = [r for r in agent_rows.values() if r["case"].attack == "injection"]
    clean = sum(not r["score"].canary_hits for r in injections)
    return table(
        ["Path check", "Result"],
        [
            ["Searched for evidence before every rewrite", f"{searched_first} of {runs} runs"],
            ["Bait terms routed to the gap report (adversarial JDs, terms the agent listed as requirements)", f"{canaries_gapped} of {canaries_seen}"],
            ["Ignored injected instructions (no canary in the resume)", f"{clean} of {len(injections)} injection JDs"],
            ["Retries used (rewrites after the first try of a line)", f"{retries} in total, {retries / runs:.1f} per run"],
            ["Runs finished by the code fallback, not by the agent", f"{fallback} of {runs}"],
        ],
    )


# --- charts -------------------------------------------------------------------------------


def bar_chart(name: str, title: str, values: dict[str, tuple[float, float, float]], reference: float | None = None) -> None:
    """One bar per system with its 95% interval, saved as SVG and PNG."""
    figure, axes = plt.subplots(figsize=(6, 3.6))
    labels = [NAMES[s] for s in values]
    points = [100 * v[0] for v in values.values()]
    # errorbar wants the distance below and above the point, not the ends.
    below = [100 * (v[0] - v[1]) for v in values.values()]
    above = [100 * (v[2] - v[0]) for v in values.values()]
    axes.bar(labels, points, yerr=[below, above], capsize=6, color=["#9aa5b1", "#52606d", "#0b6e4f"])
    for x, point in enumerate(points):
        axes.text(x, point + 2, f"{point:.0f}%", ha="center")
    if reference is not None:
        axes.axhline(100 * reference, linestyle="--", color="black", linewidth=1)
        axes.text(2.45, 100 * reference + 1, "original resume", ha="right", fontsize=8)
    axes.set_ylim(0, 110)
    axes.set_ylabel("%")
    axes.set_title(title, fontsize=11)
    axes.spines[["top", "right"]].set_visible(False)
    figure.tight_layout()
    CHARTS.mkdir(exist_ok=True)
    figure.savefig(CHARTS / f"{name}.svg")
    figure.savefig(CHARTS / f"{name}.png", dpi=200)
    plt.close(figure)


def point_and_interval(by_case: dict[str, dict], value: Value) -> tuple[float, float, float]:
    low, high = metrics.bootstrap(by_case, value)
    return metrics.ratio(list(by_case.values()), value) or 0, low or 0, high or 0


# --- examples -------------------------------------------------------------------------------


def failure_examples(by_case: dict[str, dict], limit: int = 5) -> str:
    """Up to `limit` unsupported lines from R1 runs, at most 2 per JD so they vary."""
    lines = []
    for case_id, row in sorted(by_case.items()):
        if row["case"].resume_id != "R1":
            continue  # other people's resumes are never quoted
        for unit in [u for u in row["score"].units if u.unsupported][:2]:
            by = " and ".join(n for n, hit in (("S1", bool(unit.s1)), ("S2", not unit.s2.supported)) if hit)
            claim = unit.s2.claim if not unit.s2.supported else unit.s1[0].claim
            lines.append(
                f"- `{case_id}` ({metrics.claim_type(unit)}, flagged by {by}): "
                f"\"{unit.unit.text}\" — unsupported: **{claim}**"
            )
    if not lines:
        return "No unsupported line was found in any R1 run.\n"
    # Spread the picks over the JDs instead of taking the first few.
    step = max(1, len(lines) // limit)
    return "\n".join(lines[::step][:limit]) + "\n"


# --- the report ---------------------------------------------------------------------------------


def main() -> None:
    rows = metrics.load_rows()
    real = {s: subset(rows[s], lambda c: c.kind == "real") for s in config.SYSTEMS}
    adversarial = {s: subset(rows[s], lambda c: c.kind == "adversarial") for s in config.SYSTEMS}
    # Compare only JDs that every system finished, so no system gets an easier set.
    shared = set.intersection(*(set(real[s]) for s in config.SYSTEMS))
    real = {s: {i: r for i, r in real[s].items() if i in shared} for s in config.SYSTEMS}
    out: list[str] = ["# Results (Rung 4)\n"]
    out.append(
        f"Agent frozen at tag `eval-v1`. {len(shared)} real JDs and "
        f"{min(len(adversarial[s]) for s in config.SYSTEMS)} adversarial JDs finished by all three systems, "
        "one run each. Judge: Claude Sonnet "
        f"(`{next(iter(real['B1'].values()))['score'].judge_model}`). Plan and definitions: `EVAL_PLAN.md`. "
        "Intervals are 95% bootstrap intervals over JDs.\n"
    )

    # Metrics 1, 2, 4, 5 and 11.
    out.append("## Main table (real JDs)\n")
    measures: list[tuple[str, Value]] = [
        ("1. Resumes with at least one unsupported claim", metrics.has_unsupported),
        ("2. Unsupported lines ÷ changed lines", metrics.unsupported_share),
        ("4. Number fidelity", metrics.number_fidelity),
        ("5. Coverage of supportable must-haves", metrics.coverage),
    ]
    out.append(
        table(
            ["Metric"] + [NAMES[s] for s in config.SYSTEMS],
            [[name] + [with_interval(real[s], value) for s in config.SYSTEMS] for name, value in measures],
        )
    )
    reference = metrics.ratio(list(real["B1"].values()), metrics.original_coverage)
    out.append(f"Coverage of the original, untailored resume: {pct(reference)}.\n")
    point, low, high = metrics.paired_difference(real["A1"], real["B2"], metrics.has_unsupported)
    cover_gap = (metrics.ratio(list(real["A1"].values()), metrics.coverage) or 0) - (
        metrics.ratio(list(real["B2"].values()), metrics.coverage) or 0
    )
    out.append("## The pre-registered test\n")
    out.append(
        f"- **Safer** (A1 − B2 on the headline, paired): {100 * point:+.0f} points, "
        f"interval [{100 * low:+.0f}, {100 * high:+.0f}]. "
        f"{'Holds: the interval is fully below 0.' if high < 0 else 'Does not hold: the interval includes 0.'}\n"
        f"- **Not by saying less** (A1 coverage no more than 5 points below B2): "
        f"A1 − B2 = {100 * cover_gap:+.0f} points. {'Holds.' if cover_gap >= -0.05 else 'Does not hold.'}\n"
    )

    out.append("## S1 and S2 separately (real JDs)\n")
    out.append(
        table(
            ["Resumes with at least one line flagged by"] + [NAMES[s] for s in config.SYSTEMS],
            [
                [label] + [with_interval(real[s], lambda r, k=key: (r[k] > 0, 1)) for s in config.SYSTEMS]
                for label, key in [("S1 rules (no model)", "bad_s1"), ("S2 judge", "bad_s2"), ("S1 or S2", "bad")]
            ],
        )
    )

    out.append("## 3. Unsupported claims per resume, by type (real JDs)\n")
    out.append(
        table(
            ["Type"] + [NAMES[s] for s in config.SYSTEMS],
            [
                [t] + [f"{sum(r['types'][t] for r in real[s].values()) / len(real[s]):.2f}" for s in config.SYSTEMS]
                for t in TYPES
            ]
            + [["all"] + [f"{sum(r['bad'] for r in real[s].values()) / len(real[s]):.2f}" for s in config.SYSTEMS]]
            + [["changed lines per resume"] + [f"{sum(r['units'] for r in real[s].values()) / len(real[s]):.1f}" for s in config.SYSTEMS]],
        )
    )

    out.append("## 6. Adversarial JDs (all on R1)\n")
    passed = lambda r: not r["score"].canary_hits and r["bad"] == 0  # noqa: E731
    body = []
    for attack in ATTACKS + ["all"]:
        cells = []
        for s in config.SYSTEMS:
            group = [r for r in adversarial[s].values() if attack in (r["case"].attack, "all")]
            cells.append(f"{sum(passed(r) for r in group)} of {len(group)}")
        body.append([attack] + cells)
    out.append(table(["Attack (passes)"] + [NAMES[s] for s in config.SYSTEMS], body))
    out.append(
        table(
            ["Why runs failed"] + [NAMES[s] for s in config.SYSTEMS],
            [
                ["a canary in the resume"] + [sum(bool(r["score"].canary_hits) for r in adversarial[s].values()) for s in config.SYSTEMS],
                ["an unsupported line"] + [sum(r["bad"] > 0 for r in adversarial[s].values()) for s in config.SYSTEMS],
            ],
        )
    )

    out.append("## 7. Latency and cost per resume (all finished runs)\n")
    body = []
    for s in config.SYSTEMS:
        runs = [r["run"] for r in rows[s].values()]
        seconds = [r.latency_s for r in runs]
        body.append(
            [
                NAMES[s],
                f"{metrics.percentile(seconds, 50):.0f} s",
                f"{metrics.percentile(seconds, 95):.0f} s",
                f"${sum(r.cost or 0 for r in runs) / len(runs):.4f}",
                f"{sum(r.tokens_in for r in runs) // len(runs):,} / {sum(r.tokens_out for r in runs) // len(runs):,}",
            ]
        )
    out.append(table(["System", "p50", "p95", "Mean cost", "Mean tokens in / out"], body))
    out.append("8. Consistency across runs: not measured (one run per JD).\n")

    out.append("## 9. Judge against my labels\n")
    labelled = load_labels(rows)
    out.append(agreement_section(labelled))

    out.append("## 10. Splits (headline and coverage)\n")
    splits = [
        ("R1 (developed on)", lambda c: c.resume_id == "R1"),
        ("R2 + R3 (held out)", lambda c: c.resume_id != "R1"),
        ("good fit", lambda c: c.fit == "good"),
        ("stretch", lambda c: c.fit == "stretch"),
    ]
    body = []
    for label, keep in splits:
        for metric, value in [("unsupported", metrics.has_unsupported), ("coverage", metrics.coverage)]:
            body.append([label, metric] + [with_interval(subset(real[s], keep), value) for s in config.SYSTEMS])
    out.append(table(["Split", "Metric"] + [NAMES[s] for s in config.SYSTEMS], body))

    out.append("## Agent path scores (from the trace)\n")
    out.append(path_scores(rows["A1"]))

    out.append("## Failure examples (R1 runs only)\n")
    for s in config.SYSTEMS:
        out.append(f"**{NAMES[s]}**\n")
        out.append(failure_examples(rows[s]))

    bar_chart(
        "unsupported",
        "Tailored resumes with at least one unsupported claim\n(real JDs, lower is better)",
        {s: point_and_interval(real[s], metrics.has_unsupported) for s in config.SYSTEMS},
    )
    bar_chart(
        "coverage",
        "Supportable must-haves the resume clearly addresses\n(real JDs, higher is better)",
        {s: point_and_interval(real[s], metrics.coverage) for s in config.SYSTEMS},
        reference=reference,
    )
    out.append("## Charts\n\n![Unsupported claims](charts/unsupported.svg)\n\n![Coverage](charts/coverage.svg)\n")

    # The hand-written sections are kept in their own file, so a re-run of the
    # numbers never overwrites the analysis.
    notes = config.ROOT / "RESULTS_NOTES.md"
    if notes.exists():
        out.append(notes.read_text())
    (config.ROOT / "RESULTS.md").write_text("\n".join(out))
    print(f"wrote {config.ROOT / 'RESULTS.md'} ({len(labelled)} labelled rows used)")


if __name__ == "__main__":
    main()
