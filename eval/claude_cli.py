"""One plain Claude call for the judge, through the Claude Code CLI (`claude -p`).

There is no Anthropic API key: this runs on the Claude Pro subscription. The
flags turn Claude Code into a bare model call: our own system prompt replaces
its default one, and tools, MCP servers, skills and settings files are all off.
"""

import json
import re
import subprocess
import tempfile
import time
from typing import TypeVar

from pydantic import BaseModel

from eval.gemini import Usage

T = TypeVar("T", bound=BaseModel)

PAUSE_S = 5  # wait after every call, so the eval does not burn the Pro quota in bursts
TRIES = 3  # per call, for failures that are not a usage limit
TIMEOUT_S = 600  # give up on one call after 10 minutes
_LIMIT = re.compile(r"usage limit|rate limit|limit reached|out of extra usage|quota", re.I)


class UsageLimit(RuntimeError):
    """The Pro plan's usage limit was hit. Stop now and resume later."""


def _call(model: str, system: str, user: str, schema: type[BaseModel]) -> dict:
    """Run the CLI once and return its JSON result."""
    command = [
        "claude", "-p",  # print mode: answer once and exit
        "--model", model,
        "--system-prompt", system,  # replaces Claude Code's own system prompt
        "--tools", "",  # no tools at all
        "--strict-mcp-config",  # no MCP servers (none are passed)
        "--setting-sources", "",  # no user, project or local settings files
        "--disable-slash-commands",  # no skills
        "--json-schema", json.dumps(schema.model_json_schema()),
        "--output-format", "json",  # one JSON object with the answer and the usage
        "--no-session-persistence",  # nothing is saved to disk
    ]  # fmt: skip
    # Run in an empty folder, so no CLAUDE.md or project file of this repo can
    # leak into the judge's context. The prompt goes in on stdin, not as an
    # argument, because a resume plus a JD is too long for a command line.
    with tempfile.TemporaryDirectory() as empty:
        done = subprocess.run(
            command, input=user, capture_output=True, text=True, timeout=TIMEOUT_S, cwd=empty
        )
    if _LIMIT.search(done.stdout + done.stderr) and (done.returncode or '"is_error":true' in done.stdout):
        raise UsageLimit((done.stdout or done.stderr)[-300:])
    if done.returncode:
        # The CLI often puts its error in the JSON on stdout, not on stderr.
        raise RuntimeError(
            f"claude exited with {done.returncode}: {done.stderr[-300:]} {done.stdout[-600:]}"
        )
    result = json.loads(done.stdout)
    if result.get("is_error"):
        raise RuntimeError(f"claude returned an error: {str(result.get('result'))[:300]}")
    return result


def _answer(result: dict, schema: type[T]) -> T:
    """The validated answer: the structured output, or JSON found in the text."""
    if result.get("structured_output") is not None:
        return schema.model_validate(result["structured_output"])
    # Fallback (spec): cut the JSON object out of the text and validate it the same way.
    text = result.get("result") or ""
    return schema.model_validate_json(text[text.index("{") : text.rindex("}") + 1])


def ask(*, model: str, system: str, user: str, schema: type[T]) -> tuple[T, Usage]:
    """Call Claude once and return the validated answer with its token usage."""
    for attempt in range(1, TRIES + 1):
        try:
            result = _call(model, system, user, schema)
            answer = _answer(result, schema)
            break
        except UsageLimit:
            raise  # waiting a few seconds will not help: the caller must stop
        except Exception:  # noqa: BLE001  a timeout, bad JSON or a failed validation
            if attempt == TRIES:
                raise
            time.sleep(PAUSE_S * 4 * attempt)
    time.sleep(PAUSE_S)
    used = result.get("usage") or {}
    # The exact model name is the key of modelUsage, e.g. "claude-sonnet-...".
    version = next(iter(result.get("modelUsage") or {}), model)
    return answer, Usage(
        model=model,
        version=version,
        # Cached input is still input the model read, so all three are added.
        tokens_in=sum(
            used.get(key) or 0
            for key in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
        ),
        tokens_out=used.get("output_tokens") or 0,
    )
