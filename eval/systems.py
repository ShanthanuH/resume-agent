"""The systems under test (spec A3). Each takes a Case and returns a RunRecord.

B1  naive prompt, one call
B2  careful prompt, one call (the fair baseline)
A0  the agent with the verifier switched off (ablation)
A1  the full agent
"""

import re
import time
from collections.abc import Callable
from functools import lru_cache

from eval import config, gemini
from eval.data import Case, load_cases, load_resume
from eval.schema import RunRecord, TailoredResume, from_agent
from resume_agent import llm
from resume_agent.agent import run_agent, start_session

# --- baselines -----------------------------------------------------------------

# Says only how to lay out the answer. It gives no advice on what to write, so
# it does not make the naive prompt any less naive.
FORMAT = (
    "Return the complete tailored resume as JSON. Keep the sections in order. "
    "Each section has entries (one job, project or degree each) with title, "
    "organization and dates (an empty string when there is none) and its "
    "lines: one string per bullet, summary sentence or skills row."
)
B1_PROMPT = "Tailor this resume to this job description."
# The rule is the spec's wording, word for word.
B2_PROMPT = (
    B1_PROMPT + " Do not add any skill, tool, number, date, title, employer, "
    "team size or achievement that is not in the original resume."
)


def baseline_user_message(case: Case) -> str:
    """The resume and the JD as one message. B3 sends exactly the same text."""
    return f"RESUME:\n{load_resume(case.resume_id).text}\n\nJOB DESCRIPTION:\n{case.jd_text}"


def _baseline(case: Case, prompt: str) -> dict:
    started = time.perf_counter()
    output, usage = gemini.ask(
        model=config.BASELINE_MODEL,
        system=f"{prompt}\n\n{FORMAT}",
        user=baseline_user_message(case),
        schema=TailoredResume,
        temperature=config.BASELINE_TEMPERATURE,
    )
    return {
        "output": output,
        "latency_s": time.perf_counter() - started,
        "models": {usage.model: [1, usage.tokens_in, usage.tokens_out]},
    }


# --- the agent -------------------------------------------------------------------

# A tool that crashed on one of these is the API's fault (rate limit, server
# error, overloaded), not the agent's behaviour. Such a run is thrown away and
# started again. Any other tool crash stays in the run and is scored as it is.
_API_FAULT = re.compile(r"\b(429|500|503)\b")


def _agent(case: Case, verifier_on: bool) -> dict:
    resume = load_resume(case.resume_id)
    # Each worker process runs one case at a time, so after clearing, the
    # agent's global token counter holds this case and nothing else.
    llm.USAGE.clear()
    started = time.perf_counter()
    session = start_session(
        resume.text,
        case.jd_text,
        resume.links,
        # Spec: ask_user gives no answer, so no new fact can enter. The empty
        # string is what the agent itself treats as "no answer".
        ask_user=lambda question: "",
        verifier_on=verifier_on,
    )
    run_agent(session)  # every proposed change is accepted: the agent's resume is final
    latency_s = time.perf_counter() - started
    for step in session.trace:
        if step.decision == "error" and _API_FAULT.search(str(step.output)):
            raise RuntimeError(f"API fault inside the run: {step.output}")
    return {
        "output": from_agent(session.resume),
        "latency_s": latency_s,
        "models": {model: list(totals) for model, totals in llm.USAGE.items()},
        "trace": [step.model_dump() for step in session.trace],
        "requirements": [r.model_dump() for r in session.requirements.values()],
        "gaps": [r.text for r in session.requirements.values() if r.status == "gap"],
    }


SYSTEMS: dict[str, Callable[[Case], dict]] = {
    "B1": lambda case: _baseline(case, B1_PROMPT),
    "B2": lambda case: _baseline(case, B2_PROMPT),
    "A0": lambda case: _agent(case, verifier_on=False),
    "A1": lambda case: _agent(case, verifier_on=True),
}


# --- one case --------------------------------------------------------------------


@lru_cache
def _cases() -> dict[str, Case]:
    return {case.id: case for case in load_cases()}


def run_case(system: str, case_id: str, run: int) -> RunRecord:
    """Run one (system, case, run) and return its record. Retries on any error.

    It takes the case's ID, not the Case, because it runs in a worker process
    and plain strings are the simplest thing to send to one.
    """
    wait = config.RETRY_WAIT_S
    for attempt in range(1, config.CASE_TRIES + 1):
        try:
            result = SYSTEMS[system](_cases()[case_id])
            break
        except Exception:  # noqa: BLE001  any failure is worth one more try
            if attempt == config.CASE_TRIES:
                raise  # the main loop reports it; the case stays unfinished
            time.sleep(wait)
            wait *= 2  # back off: wait longer before each new try
    tokens_in = sum(t[1] for t in result["models"].values())
    tokens_out = sum(t[2] for t in result["models"].values())
    costs = [config.cost(m, t[1], t[2]) for m, t in result["models"].items()]
    return RunRecord(
        system=system,
        case_id=case_id,
        run=run,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        # One unknown price makes the whole sum unknown, never a guess.
        cost=None if None in costs else sum(costs),
        tries=attempt,
        **result,
    )
