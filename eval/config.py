"""Every setting of the eval in one place. EVAL_PLAN.md describes these in words."""

from pathlib import Path

from resume_agent import llm

# --- models --------------------------------------------------------------------
# The agent's defaults are "-latest" aliases, which Google can repoint at any
# time. The eval pins the exact models, so every run uses the same ones.
# These are assigned (not set through env vars) because the agent reads the
# names from the llm module at call time, whatever was imported first.
llm.STRONG_MODEL = llm.AGENT_MODEL = "gemini-3.8-flash"  # agent turns and rewriting
llm.CHEAP_MODEL = llm.JUDGE_MODEL = "gemini-3.5-flash-lite"  # parsing, search, verifier

BASELINE_MODEL = llm.STRONG_MODEL  # B1 and B2: same model as the agent's rewriting
BASELINE_TEMPERATURE = 0.0  # same temperature as the agent's rewriting step
# S2 and coverage: Claude Sonnet through the Claude Code CLI, on a flat
# subscription. A different provider from every system under test. "sonnet" is
# the CLI's alias; the exact model name is read from each call's output.
JUDGE_MODEL = "sonnet"

PRICES = llm.PRICES  # US dollars per million tokens (input, output), Gemini only

# --- runs ----------------------------------------------------------------------
# A0 (verifier off) and B3 (careful prompt on Claude) were dropped for budget.
# The cheap systems come first, so a spend cap can only ever cut A1 cases.
SYSTEMS = ["B1", "B2", "A1"]
RUNS = {"B1": 1, "B2": 1, "A0": 1, "A1": 1}  # runs per (system, JD)
WORKERS = 3  # cases run at the same time
INR_PER_USD = 88  # assumed exchange rate, used only to turn the cap into dollars
SPEND_CAP_USD = 350 / INR_PER_USD  # hard cap on Gemini spend for the full run
CASE_TRIES = 3  # times one case is started before it is reported as failed
RETRY_WAIT_S = 30  # wait before try 2; doubled before try 3

# --- files (all gitignored: they hold resume text) -------------------------------
ROOT = Path(__file__).parent
RUNS_DIR = ROOT / "runs"  # one JSON per (system, case, run): the saved output
SCORES_DIR = ROOT / "scores"  # one JSON per saved output: its scores
CACHE_DIR = ROOT / "cache"  # must-have lists, one per real JD


def cost(model: str, tokens_in: int, tokens_out: int) -> float | None:
    """Dollar cost of some tokens, or None when the model has no known price."""
    if model not in PRICES:
        return None
    price_in, price_out = PRICES[model]
    return (tokens_in * price_in + tokens_out * price_out) / 1_000_000
