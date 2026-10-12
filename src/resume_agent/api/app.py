"""FastAPI app: one streamed agent run per request, and a PDF renderer.

Nothing is stored. A run lives in memory while its request is open; the result
is sent to the browser, and the browser sends it back when it wants a PDF.

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


class NothingParsed(Exception):
    """The resume or the job description gave the parser nothing to work with."""


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"message": message}, status_code=status)


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


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "bot_check": limits.bot_check_enabled(),
        "replay": bool(REPLAY_FILE),
        # Which counter is in use: RedisCounter in production, ClosedCounter if
        # Redis is not set up yet. Handy for checking a deploy.
        "counter": type(counter).__name__,
    }


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
            return _error(413, "That file is over 2 MB. Try a smaller PDF, or paste the text.")
        if not data.startswith(b"%PDF"):  # every PDF file starts with these bytes
            return _error(415, "Only PDF files work for now. You can also paste the text.")
        try:
            resume_text, links = await asyncio.to_thread(_read_pdf, data)
        except Exception:  # noqa: BLE001  a broken or locked PDF
            return _error(422, "That PDF could not be read. Paste the text instead.")
        if len(resume_text.strip()) < limits.MIN_CHARS:
            return _error(
                422,
                "That PDF has no selectable text. It may be a scan. Paste the text instead.",
            )
    resume_text, jd_text = resume_text.strip(), jd_text.strip()
    if len(resume_text) < limits.MIN_CHARS:
        return _error(422, "Add your resume: upload a PDF or paste the text.")
    if len(jd_text) < limits.MIN_CHARS:
        return _error(422, "Paste the full job description. That one is too short.")
    if len(resume_text) > limits.MAX_RESUME_CHARS:
        return _error(413, "That resume is too long. Keep it under about four pages.")
    if len(jd_text) > limits.MAX_JD_CHARS:
        return _error(413, "That job description is too long. Paste only the posting.")

    peer = request.client.host if request.client else "unknown"
    ip = limits.client_ip(request.headers.get("x-forwarded-for"), peer)
    if not await limits.passes_bot_check(turnstile_token, ip):
        return _error(403, "The bot check did not pass. Reload the page and try again.")
    try:
        await counter.claim(ip)
    except limits.LimitReached as reached:
        return _error(429, str(reached))

    stream = _replay() if REPLAY_FILE else _live_run(resume_text, jd_text, links, ip)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        # Tell proxies not to cache or buffer, so each step arrives as it happens.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _live_run(
    resume_text: str, jd_text: str, links: list[Link], ip: str
) -> AsyncIterator[str]:
    """Run the agent in a worker thread and stream its trace as it grows."""
    run_id = uuid.uuid4().hex[:8]  # only for matching log lines; says nothing about the user
    safe_text, found = redact(resume_text)  # contact details never reach a model
    holder: dict[str, Session] = {}

    def work() -> None:
        # ask_user always answers with nothing: the questions panel is not built yet.
        session = start_session(safe_text, jd_text, links, lambda question: "")
        holder["session"] = session  # from here on the stream can see the trace
        if not session.evidence or not session.requirements:
            raise NothingParsed
        run_agent(session)

    if run_slot.locked():
        yield _sse("status", {"message": "Another run is in progress. Yours starts next."})
    async with run_slot:
        started = time.monotonic()
        yield _sse("status", {"message": "Reading your resume and the job description"})
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
                for step in session.trace[sent:]:
                    yield _sse("step", restore_all(describe_step(step, session), found))
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
            yield _sse("failed", {"message": "This run took too long and was stopped. Please try again."})
            await counter.refund(ip)
            await asyncio.wait([task])
            return
        error = task.exception()
        if error is not None:
            # Log the error's type only: its message could quote resume text.
            log.warning("run %s failed: %s", run_id, type(error).__name__)
            nothing_parsed = isinstance(error, NothingParsed)
            if not nothing_parsed:
                await counter.refund(ip)  # our fault or the model's, not the visitor's
            yield _sse(
                "failed",
                {
                    "message": "We could not find resume lines or job requirements in "
                    "that text. Check both boxes and try again."
                    if nothing_parsed
                    else "The model service had a problem. Nothing was saved. "
                    "Please try again in a minute."
                },
            )
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
    """Send a saved run step by step, as a live run would. Calls no model."""
    saved = json.loads(Path(REPLAY_FILE).read_text())
    yield _sse("status", {"message": "Reading your resume and the job description"})
    for step in saved["steps"]:
        await asyncio.sleep(0.25)
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
