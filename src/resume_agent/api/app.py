"""FastAPI app: one streamed agent run per request, and a PDF renderer.

Nothing is stored. A run lives in memory while its request is open; the result
is sent to the browser, and the browser sends it back when it wants a PDF.

Every error and every progress event carries a short `code`. The browser turns
the code into words from web/content/copy.yaml, so the visible text of the site
lives in one file. The `message` next to it is for logs and for anyone calling
the API by hand.

Run it locally with:
    APP_ENV=dev uv run uvicorn resume_agent.api.app:app --reload --port 8000
"""

import asyncio
import json
import logging
import os
import tempfile
import time
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from google.genai.errors import APIError

from resume_agent.agent import run_agent, start_session
from resume_agent.api import limits
from resume_agent.api.payload import build_result, describe_step, restore_all
from resume_agent.api.redact import redact
from resume_agent.api.render import ResumeDoc, render_pdf, split_header
from resume_agent.extract import Link, extract_resume_pdf
from resume_agent.session import Session

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
log = logging.getLogger("resume_agent.api")
# parsing.py logs the text of resume lines it drops. Resume text must never
# reach the logs, so that logger is limited to errors here.
logging.getLogger("resume_agent.parsing").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.WARNING)  # no line per model request

RUN_TIMEOUT_SECONDS = 240  # a normal run takes well under two minutes
POLL_SECONDS = 0.3  # how often the stream looks for new trace steps
HEARTBEAT_SECONDS = 10  # send something this often so proxies keep the stream open
# Path to a saved run (the example page's JSON). When set, /api/run replays it
# and calls no model. Used to build and test the frontend for free.
REPLAY_FILE = os.environ.get("REPLAY_FILE", "")
REPLAY_STEP_SECONDS = 0.25  # the pause between steps when REPLAY_FILE is played
# HTTP statuses from the model provider that mean "this account cannot run
# right now": a bad or blocked key, billing switched off, or the quota used up.
# llm.py has already retried a 429 three times before it gets here, so by now it
# is a spent quota and not a busy moment. Trying again would fail the same way.
PAUSED_MODEL_CODES = {401, 402, 403, 429}

app = FastAPI(title="resume-agent API", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    # The browser may only call this API from the frontend's own address.
    allow_origins=[
        o.strip()
        for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

counter = limits.make_counter()
# llm.USAGE is one counter for the whole process, so two runs at once would mix
# their token counts and report wrong costs. One run at a time keeps them right.
run_slot = asyncio.Semaphore(1)

# /api/status is open to anyone, with no bot check in front of it. Its answer
# is remembered for this long, so that however often it is asked, this server
# reads the count from Redis at most once in that time. Without it, someone
# could use up the Redis free quota just by asking, and a Redis that cannot
# answer pauses the demo.
STATUS_TTL_SECONDS = 20
_status_memo: tuple[float, str] | None = None  # (when it was read, the answer)


async def _runs_state() -> str:
    """Today's state from the counter, read at most once per STATUS_TTL_SECONDS."""
    global _status_memo  # this function replaces the remembered answer
    now = time.monotonic()
    if _status_memo is not None and now - _status_memo[0] < STATUS_TTL_SECONDS:
        return _status_memo[1]
    state = await counter.state()
    _status_memo = (now, state)
    return state


class NothingParsed(Exception):
    """The resume or the job description gave the parser nothing to work with."""


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"code": code, "message": message}, status_code=status)


def _sse(event: str, data: dict[str, Any]) -> str:
    """One Server-Sent Event: an event name, a JSON body, then a blank line."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _read_pdf(data: bytes) -> tuple[str, list[Link]]:
    """Extract text and links from an uploaded PDF, then delete the temp file."""
    # extract_resume_pdf takes a path, so the upload is written to a temp file.
    # Leaving the with block deletes it, even if extraction raises.
    with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
        handle.write(data)
        handle.flush()  # make sure the bytes are on disk before PyMuPDF opens it
        extracted = extract_resume_pdf(Path(handle.name))
    return extracted.text, extracted.links


def _model_account_is_out(error: BaseException) -> bool:
    """True if the model provider refused because of the key, billing or quota."""
    if not isinstance(error, APIError):
        return False
    # FAILED_PRECONDITION is what Gemini answers when billing is not enabled.
    return error.code in PAUSED_MODEL_CODES or error.status == "FAILED_PRECONDITION"


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "bot_check": limits.bot_check_enabled(),
        "replay": bool(REPLAY_FILE),
        # Which counter is in use: RedisCounter in production, ClosedCounter if
        # Redis is not set up yet. Handy for checking a deploy.
        "counter": type(counter).__name__,
        "paused": limits.live_runs_off(),
    }


@app.get("/api/status")
async def status() -> JSONResponse:
    """Whether a live run could start right now: "open", "limited" or "paused".

    The page asks this before the visitor uploads anything, so that when the
    day's runs are gone they are told at once and offered the recorded run. It
    only reads the site-wide count. Nothing about the visitor is looked at, so
    the answer is the same for everyone and the CDN may share it for a moment.
    The answer can be some seconds old. That is fine: /api/run checks for real.
    """
    runs = "paused" if limits.live_runs_off() else await _runs_state()
    return JSONResponse(
        {"runs": runs},
        # s-maxage lets the CDN answer for 15 seconds without waking this
        # function, which matters when an ad sends many visitors at once.
        headers={"Cache-Control": "public, s-maxage=15, stale-while-revalidate=45"},
    )


@app.post("/api/run")
async def run(
    request: Request,
    jd_text: str = Form(""),
    resume_text: str = Form(""),
    turnstile_token: str = Form(""),
    resume_file: UploadFile | None = None,
):
    """Validate the input, then stream the agent's steps and the final result."""
    links: list[Link] = []
    if resume_file is not None and resume_file.filename:
        # Read one byte past the limit: enough to know the file is too big
        # without loading a huge upload into memory.
        data = await resume_file.read(limits.MAX_FILE_BYTES + 1)
        if len(data) > limits.MAX_FILE_BYTES:
            return _error(413, "file_too_big", "That file is over 2 MB. Try a smaller PDF, or paste the text.")
        if not data.startswith(b"%PDF"):  # every PDF file starts with these bytes
            return _error(415, "file_not_pdf", "Only PDF files work for now. You can also paste the text.")
        try:
            resume_text, links = await asyncio.to_thread(_read_pdf, data)
        except Exception:  # noqa: BLE001  a broken or locked PDF
            return _error(422, "file_unreadable", "That PDF could not be read. Paste the text instead.")
        if len(resume_text.strip()) < limits.MIN_CHARS:
            return _error(
                422,
                "file_no_text",
                "That PDF has no selectable text. It may be a scan. Paste the text instead.",
            )
    resume_text, jd_text = resume_text.strip(), jd_text.strip()
    if len(resume_text) < limits.MIN_CHARS:
        return _error(422, "resume_too_short", "Add your resume: upload a PDF or paste the text.")
    if len(jd_text) < limits.MIN_CHARS:
        return _error(422, "job_too_short", "Paste the full job description. That one is too short.")
    if len(resume_text) > limits.MAX_RESUME_CHARS:
        return _error(413, "resume_too_long", "That resume is too long. Keep it under about four pages.")
    if len(jd_text) > limits.MAX_JD_CHARS:
        return _error(413, "job_too_long", "That job description is too long. Paste only the posting.")

    if limits.live_runs_off():
        # Checked before the bot check and the count, so a paused site spends
        # nothing: no Cloudflare call, no run taken from the day's total.
        return _error(503, "paused", limits.UNAVAILABLE_MESSAGE)
    peer = request.client.host if request.client else "unknown"
    ip = limits.client_ip(request.headers.get("x-forwarded-for"), peer)
    if not await limits.passes_bot_check(turnstile_token, ip):
        return _error(403, "bot_check", "The bot check did not pass. Reload the page and try again.")
    # The owner's test runs are not counted. counted_ip is None for them, which
    # also tells _live_run there is nothing to refund if the run fails.
    counted_ip = None if limits.is_owner(request.headers.get("x-owner-key")) else ip
    if counted_ip is not None:
        try:
            await counter.claim(counted_ip)
        except limits.LimitReached as reached:
            return _error(429, reached.code, str(reached))

    stream = _replay() if REPLAY_FILE else _live_run(resume_text, jd_text, links, counted_ip)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        # Tell proxies not to cache or buffer, so each step arrives as it happens.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _live_run(
    resume_text: str, jd_text: str, links: list[Link], ip: str | None
) -> AsyncIterator[str]:
    """Run the agent in a worker thread and stream its trace as it grows."""
    run_id = uuid.uuid4().hex[:8]  # only for matching log lines; says nothing about the user
    safe_text, found = redact(resume_text)  # contact details never reach a model
    holder: dict[str, Session] = {}

    def work() -> None:
        # ask_user always answers with nothing. The questions are shown to the
        # visitor after the run, in the result (see payload.questions).
        session = start_session(safe_text, jd_text, links, lambda question: "")
        holder["session"] = session  # from here on the stream can see the trace
        if not session.evidence or not session.requirements:
            raise NothingParsed
        run_agent(session)

    if run_slot.locked():
        yield _sse("status", {"code": "queued"})  # another run holds the slot
    async with run_slot:
        started = time.monotonic()
        yield _sse("status", {"code": "started"})
        # The agent code is blocking, so it runs in a thread and this coroutine
        # stays free to send events.
        task = asyncio.create_task(asyncio.to_thread(work))
        sent = 0  # how many trace steps the browser already has
        last_event = time.monotonic()
        timed_out = False
        while True:
            finished = task.done()  # read BEFORE draining, so no late step is missed
            session = holder.get("session")
            if session is not None:
                # When these steps reached the browser, in milliseconds from the
                # start. A saved run keeps it, so a replay can move the same way.
                at = int((time.monotonic() - started) * 1000)
                for step in session.trace[sent:]:
                    described = {**describe_step(step, session), "at": at}
                    yield _sse("step", restore_all(described, found))
                    last_event = time.monotonic()
                sent = len(session.trace)
            if finished:
                break
            if time.monotonic() - started > RUN_TIMEOUT_SECONDS:
                timed_out = True
                break
            if time.monotonic() - last_event > HEARTBEAT_SECONDS:
                yield ": keep-alive\n\n"  # a comment line: browsers ignore it
                last_event = time.monotonic()
            await asyncio.sleep(POLL_SECONDS)

        seconds = time.monotonic() - started
        if timed_out:
            # The thread cannot be stopped; MAX_TURNS ends it soon. Wait for it
            # here so the next run does not start while it still uses the counter.
            log.warning("run %s timed out after %.0fs", run_id, seconds)
            yield _sse("failed", {"code": "timeout", "message": "This run took too long and was stopped."})
            if ip is not None:  # None: an owner run, which was never counted
                await counter.refund(ip)
            await asyncio.wait([task])
            return
        error = task.exception()
        if error is not None:
            # Log the error's type only: its message could quote resume text.
            log.warning("run %s failed: %s", run_id, type(error).__name__)
            nothing_parsed = isinstance(error, NothingParsed)
            if not nothing_parsed and ip is not None:
                await counter.refund(ip)  # our fault or the model's, not the visitor's
            if nothing_parsed:
                code, message = "nothing_parsed", "No resume lines or job requirements were found."
            elif _model_account_is_out(error):
                # Not a blip: the model account has no credit or a bad key. The
                # visitor is shown "paused" and the recorded run, not "try again".
                code, message = "paused", limits.UNAVAILABLE_MESSAGE
            else:
                code, message = "model_error", "The model service had a problem. Nothing was saved."
            yield _sse("failed", {"code": code, "message": message})
            return
        session = holder["session"]
        result = build_result(session, split_header(safe_text, list(session.evidence.values())), seconds)
        stats = result["stats"]
        # Numbers only. No resume text, no job text, no IP address.
        log.info(
            "run %s done seconds=%s steps=%s tokens_in=%s tokens_out=%s cost_usd=%s bullets=%s",
            run_id, stats["seconds"], stats["steps"], stats["tokens_in"],
            stats["tokens_out"], stats["cost_usd"], len(result["bullets"]),
        )
        yield _sse("done", restore_all(result, found))


async def _replay() -> AsyncIterator[str]:
    """Send a saved run step by step over the real stream. Calls no model.

    This is for testing the network path (upload, bot check, limits, stream)
    for free. The replay a visitor watches is played in the browser, with the
    run's real timing: see web/lib/replay.ts.
    """
    saved = json.loads(Path(REPLAY_FILE).read_text())
    yield _sse("status", {"code": "started"})
    for step in saved["steps"]:
        await asyncio.sleep(REPLAY_STEP_SECONDS)
        yield _sse("step", step)
    yield _sse("done", saved["result"])


@app.post("/api/pdf")
def pdf(doc: ResumeDoc) -> Response:
    """Render the reviewed resume. The page count is reported, never hidden."""
    data, pages = render_pdf(doc)
    return Response(
        data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="resume.pdf"',
            "X-Page-Count": str(pages),
            # Without this the browser's JavaScript cannot read the header above.
            "Access-Control-Expose-Headers": "X-Page-Count",
        },
    )
