"""A run that times out, or whose visitor leaves, stops spending tokens at once.

Gemini is replaced by a local server that takes the request and never answers,
like a model call still thinking. The tests check that the call is cut off (the
server sees its connection close) and that the agent makes no call after it.

Also the run clock: it starts when the request arrives, and a run that would
wait too long for another one is turned away, uncounted.
"""

import asyncio
import contextlib
import json
import re
import socket
import threading
import time

import pytest
from fastapi.testclient import TestClient
from google import genai
from google.genai import types
from pydantic import BaseModel

from resume_agent import llm
from resume_agent.api import app as app_module
from resume_agent.api import limits

TEXT = "x" * 300  # long enough to pass the input checks; parsing it needs no model


def last_event(response) -> dict:
    """The data of the last event in a streamed response."""
    return json.loads(re.findall(r"data: (.+)\n\n", response.text)[-1])


class SilentModel:
    """A server that reads each request and never answers it."""

    def __init__(self) -> None:
        self._server = socket.create_server(("127.0.0.1", 0))
        self.url = f"http://127.0.0.1:{self._server.getsockname()[1]}"
        self.requests = 0
        self.arrived = threading.Event()  # a request came in
        self.closed = threading.Event()  # the client closed that connection
        threading.Thread(target=self._serve, daemon=True).start()

    def _serve(self) -> None:
        while True:
            conn, _ = self._server.accept()
            threading.Thread(target=self._hold, args=(conn,), daemon=True).start()

    def _hold(self, conn: socket.socket) -> None:
        with conn:
            if conn.recv(65536):
                self.requests += 1
                self.arrived.set()
            while True:
                try:
                    if not conn.recv(65536):  # empty read: the client hung up
                        break
                except OSError:
                    break
        self.closed.set()


@pytest.fixture
def model(monkeypatch) -> SilentModel:
    server = SilentModel()
    client = genai.Client(api_key="test", http_options=types.HttpOptions(base_url=server.url))
    monkeypatch.setattr(llm, "_client", lambda: client)
    return server


class Answer(BaseModel):
    text: str


def ask(stop: llm.Stop) -> None:
    with llm.stoppable(stop):
        llm.generate_structured(model="m", system="s", user="u", schema=Answer)


def test_stop_cuts_off_the_model_call_in_flight_and_refuses_the_next(model):
    stop = llm.Stop()
    outcome: list[str] = []

    def run() -> None:
        try:
            ask(stop)
        except llm.Stopped:
            outcome.append("stopped")

    worker = threading.Thread(target=run)
    worker.start()
    assert model.arrived.wait(5)
    stop.stop()
    worker.join(2)
    assert outcome == ["stopped"] and not worker.is_alive()
    assert model.closed.wait(2)  # the request was dropped, not left running
    with pytest.raises(llm.Stopped):  # a stopped run sends nothing more
        ask(stop)
    assert model.requests == 1


def test_stopped_passes_the_safety_net_that_catches_failing_tools():
    # Session.execute turns any Exception from a tool into an error for the agent
    # and carries on. Stopped must not be caught there.
    assert not issubclass(llm.Stopped, Exception)


def test_a_run_past_the_time_limit_stops_its_model_call(model, monkeypatch):
    monkeypatch.setattr(limits, "APP_ENV", "dev")  # bot check off
    monkeypatch.setattr(app_module, "counter", limits.RunCounter())
    monkeypatch.setattr(app_module, "RUN_TIMEOUT_SECONDS", 1)
    started = time.monotonic()
    response = TestClient(app_module.app).post(
        "/api/run", data={"resume_text": TEXT, "jd_text": TEXT}
    )
    assert last_event(response)["code"] == "timeout"
    assert model.closed.wait(2)
    time.sleep(0.5)  # time for a next call, if the agent were still going
    assert model.requests == 1
    assert time.monotonic() - started < 10  # not held until a model call returns


@pytest.mark.parametrize("leave", ["cancel", "close"])
def test_a_visitor_who_leaves_stops_the_run(model, monkeypatch, leave):
    # Starlette cancels the stream when the browser disconnects, or closes it
    # when sending to a gone browser fails. Both must stop the agent.
    monkeypatch.setattr(app_module, "HEARTBEAT_SECONDS", 0.05)  # so the stream yields

    async def visit_then_leave() -> None:
        stream = app_module._live_run(TEXT, TEXT, [], None, time.monotonic())
        if leave == "cancel":
            reader = asyncio.create_task(_read_all(stream))
            await asyncio.to_thread(model.arrived.wait, 5)
            reader.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await reader
        else:
            while not model.arrived.is_set():
                await anext(stream)
            await stream.aclose()

    asyncio.run(visit_then_leave())
    assert model.closed.wait(2)
    time.sleep(0.5)
    assert model.requests == 1


async def _read_all(stream) -> None:
    async for _ in stream:
        pass


# --- the run clock and the queue ---------------------------------------------------


@pytest.fixture
def slot(monkeypatch) -> asyncio.Semaphore:
    """A fresh one-run slot: an asyncio object belongs to one event loop."""
    fresh = asyncio.Semaphore(1)
    monkeypatch.setattr(app_module, "run_slot", fresh)
    return fresh


async def _events(stream) -> list[dict]:
    return [json.loads(data) for chunk in [c async for c in stream] for data in re.findall(r"data: (.+)\n", chunk)]


def test_a_run_that_would_wait_too_long_is_turned_away_uncounted(slot, monkeypatch):
    monkeypatch.setattr(app_module, "QUEUE_SECONDS", 0.2)
    counter = limits.RunCounter()
    monkeypatch.setattr(app_module, "counter", counter)
    started: list[str] = []
    monkeypatch.setattr(app_module, "start_session", lambda *args: started.append("run"))

    async def visit_while_another_runs() -> list[dict]:
        await slot.acquire()  # another visitor's run holds the slot throughout
        await counter.claim("1.2.3.4")  # what the endpoint does before it streams
        return await _events(app_module._live_run(TEXT, TEXT, [], "1.2.3.4", time.monotonic()))

    events = asyncio.run(visit_while_another_runs())
    assert [e["code"] for e in events] == ["queued", "busy"]
    assert counter.total == 0  # the claim was given back
    assert started == []  # the agent never ran


def test_a_short_wait_for_the_slot_still_runs(slot, monkeypatch):
    monkeypatch.setattr(app_module, "QUEUE_SECONDS", 5)

    def start_session(*args):
        raise app_module.NothingParsed  # ends the run at once, once it has started

    monkeypatch.setattr(app_module, "start_session", start_session)

    async def visit_just_before_the_other_run_ends() -> list[dict]:
        await slot.acquire()
        asyncio.get_running_loop().call_later(0.2, slot.release)  # the other run ends
        return await _events(app_module._live_run(TEXT, TEXT, [], None, time.monotonic()))

    events = asyncio.run(visit_just_before_the_other_run_ends())
    assert [e["code"] for e in events] == ["queued", "started", "nothing_parsed"]


def test_the_run_clock_starts_when_the_request_arrives(model, slot, monkeypatch):
    # Wait 1.5 s for the slot, then run with a 2 s limit. The limit counts from
    # arrival, so the run is stopped about 0.5 s after it starts, not 2 s after.
    monkeypatch.setattr(app_module, "RUN_TIMEOUT_SECONDS", 2)
    monkeypatch.setattr(app_module, "QUEUE_SECONDS", 5)

    async def queued_then_run() -> tuple[list[dict], float]:
        await slot.acquire()
        asyncio.get_running_loop().call_later(1.5, slot.release)
        arrived = time.monotonic()
        events = await _events(app_module._live_run(TEXT, TEXT, [], None, arrived))
        return events, time.monotonic() - arrived

    events, seconds = asyncio.run(queued_then_run())
    assert [e["code"] for e in events] == ["queued", "started", "timeout"]
    assert 2 <= seconds < 3  # from slot time it would have been 3.5 s
    assert model.closed.wait(2)
