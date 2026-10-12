"""The eval runner. Run: uv run --env-file .env python -m eval.run [options]

Runs every (system, case, run) that has no saved output yet, several at a time,
and saves each output the moment it finishes. Stop it at any point and start it
again: finished cases are skipped.
"""

import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed

from eval import config, store
from eval.data import load_cases
from eval.systems import run_case


def run_eval(
    systems: list[str], case_ids: list[str], runs: dict[str, int], workers: int, cap: float
) -> int:
    """The main eval loop. Returns how many cases failed or were cut by the cap."""
    # 1. The to-do list: every combination that has no saved file yet.
    todo = [
        (system, case_id, run)
        for system in systems
        for case_id in case_ids
        for run in range(1, runs[system] + 1)
        if not store.path(config.RUNS_DIR, system, case_id, run).exists()
    ]
    total = sum(runs[s] for s in systems) * len(case_ids)
    print(f"{len(todo)} to run, {total - len(todo)} already done")
    failed, spent, dearest = 0, 0.0, 0.0  # dearest: the most one case has cost so far
    # 2. Worker PROCESSES, not threads: the agent counts tokens in a global, so
    #    two runs in one process would mix their counts. Each process runs one
    #    case at a time.
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(run_case, *job): job for job in todo}
        # 3. Handle each case as it finishes, in whatever order that is.
        for done, future in enumerate(as_completed(futures), start=1):
            system, case_id, run = futures[future]
            if future.cancelled():  # cut by the spend cap below, already counted
                continue
            try:
                record = future.result()  # re-raises whatever the worker raised
            except Exception as err:  # noqa: BLE001
                # Not saved, so the next start of the runner tries it again.
                failed += 1
                print(f"[{done}/{len(todo)}] FAILED {system} {case_id} run {run}: {err}")
                continue
            # 4. Save at once. A crash later cannot lose this result.
            store.save(store.path(config.RUNS_DIR, system, case_id, run), record)
            print(
                f"[{done}/{len(todo)}] {system} {case_id} run {run}: "
                f"{record.latency_s:.0f} s, ${record.cost or 0:.4f}, tries {record.tries}"
            )
            # 5. The spend cap. Cases already running cannot be stopped, so stop
            #    while there is still room for each of them to cost the most
            #    seen so far. Cases not started yet are cancelled.
            spent += record.cost or 0
            dearest = max(dearest, record.cost or 0)
            if spent + workers * dearest > cap:
                cut = sum(f.cancel() for f in futures)  # cancel() is True if not started
                print(f"SPEND CAP: ${spent:.2f} spent of ${cap:.2f}; {cut} cases not started")
                failed += cut
                cap = float("inf")  # report the cut once, then let running cases finish
    return failed


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the eval systems on the JDs.")
    parser.add_argument("--systems", default=",".join(config.SYSTEMS), help="e.g. B1,B2")
    parser.add_argument("--cases", help="comma-separated case IDs; default is all 40")
    parser.add_argument("--runs", type=int, help="runs per pair; default is config.RUNS")
    parser.add_argument("--workers", type=int, default=config.WORKERS)
    parser.add_argument("--cap", type=float, default=config.SPEND_CAP_USD, help="US dollars")
    args = parser.parse_args()

    systems = args.systems.split(",")
    case_ids = args.cases.split(",") if args.cases else [c.id for c in load_cases()]
    runs = {s: args.runs or config.RUNS[s] for s in systems}
    failed = run_eval(systems, case_ids, runs, args.workers, args.cap)
    raise SystemExit(1 if failed else 0)  # non-zero so a script notices failures


if __name__ == "__main__":
    main()
