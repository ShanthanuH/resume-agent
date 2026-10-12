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
# S2 and coverage: the strongest Gemini model, and not one the agent uses.
JUDGE_MODEL = "gemini-3.1-pro-preview"
B3_MODEL = "sonnet"  # the Claude Code CLI alias; the exact name is read from its output

# US dollars per million tokens (input, output), paid tier, from
# https://ai.google.dev/gemini-api/docs/pricing on 2026-10-12.
PRICES = {**llm.PRICES, JUDGE_MODEL: (2.00, 12.00)}

# --- runs ----------------------------------------------------------------------
SYSTEMS = ["B1", "B2", "A0", "A1"]  # B3 runs separately, last and one at a time
RUNS = {"B1": 3, "B2": 3, "A0": 3, "A1": 3, "B3": 1}  # runs per (system, JD)
WORKERS = 4  # cases run at the same time
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
