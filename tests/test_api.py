"""Tests for the web API's own code: redaction, limits, rendering. No model is called."""

import asyncio
import json
import re
from pathlib import Path

import pymupdf
import pytest
from fastapi.testclient import TestClient
from google.genai.errors import APIError

from resume_agent.api import app as app_module, limits
from resume_agent.api.payload import arrival_times, build_result, describe_step
from resume_agent.api.redact import redact, restore
from resume_agent.api.render import ResumeDoc, clean_contact, render_pdf, split_header
from resume_agent.models import Entry, EvidenceLine, Requirement, TraceStep
from resume_agent.session import Session

RESUME = """Meera Kulkarni
Pune | +91 98200 55501 | meera@example.com | github.com/meera-k

Experience
Software Engineer, Lakeshore                 Jul 2019 - 2023
• Served 1,200,000 requests a day
"""


def test_redact_hides_contact_details_and_restore_brings_them_back():
    safe, found = redact(RESUME)
    for secret in ("98200", "meera@example.com", "github.com/meera-k"):
        assert secret not in safe
    assert restore(safe, found) == RESUME


def test_redact_leaves_dates_and_numbers_alone():
    safe, _ = redact(RESUME)
    assert "Jul 2019 - 2023" in safe  # a year range is not a phone number
    assert "1,200,000" in safe


def test_same_value_gets_the_same_placeholder():
    safe, found = redact("a@b.co and again a@b.co")
    assert safe == "[EMAIL_1] and again [EMAIL_1]"
    assert len(found) == 1


def test_header_is_the_lines_above_the_first_section():
    assert split_header(RESUME) == [
        "Meera Kulkarni",
        "Pune | +91 98200 55501 | meera@example.com | github.com/meera-k",
    ]


def make_doc(bullets: int) -> ResumeDoc:
    return ResumeDoc(
        header=["Meera Kulkarni", "meera@example.com | github.com/meera-k"],
        links=[{"label": "Bus Predictor", "url": "https://example.com/bus"}],
        sections=[
            {
                "name": "Projects",
                "entries": [
                    {
                        "title": "Bus Predictor",
                        "organization": "",
                        "dates": "2021",
                        # Long enough to wrap, so 60 of them cannot fit on one page.
                        "lines": [
                            f"Built thing number {n} <b>not bold</b> " + "and more " * (bullets // 3)
                            for n in range(bullets)
                        ],
                    }
                ],
            }
        ],
    )


def test_pdf_is_one_page_with_working_links_and_real_text():
    data, pages = render_pdf(make_doc(3))
    assert pages == 1
    with pymupdf.open(stream=data, filetype="pdf") as pdf:
        text = pdf[0].get_text()
        urls = {link["uri"] for link in pdf[0].get_links()}
    assert "Meera Kulkarni" in text
    assert "<b>not bold</b>" in text  # HTML in a bullet is shown as text, not run
    # The label link, the written-out URL and the email are all clickable.
    assert urls == {"https://example.com/bus", "https://github.com/meera-k", "mailto:meera@example.com"}


def test_pdf_reports_the_real_page_count_when_it_cannot_fit():
    _, pages = render_pdf(make_doc(60))
    assert pages > 1


def test_client_ip_ignores_a_spoofed_forwarded_header():
    # The visitor wrote "1.1.1.1"; our proxy appended the real address after it.
    assert limits.client_ip("1.1.1.1, 9.9.9.9", "10.0.0.1") == "9.9.9.9"
    assert limits.client_ip(None, "10.0.0.1") == "10.0.0.1"


def test_per_ip_limit_and_global_cap(monkeypatch):
    monkeypatch.setattr(limits, "RUNS_PER_IP", 2)
    monkeypatch.setattr(limits, "DAILY_RUN_CAP", 3)
    counter = limits.RunCounter()
    claim = lambda ip: asyncio.run(counter.claim(ip))  # the methods are async
    claim("a")
    claim("a")
    with pytest.raises(limits.LimitReached, match="Demo limit reached"):
        claim("a")
    claim("b")
    with pytest.raises(limits.LimitReached, match="Demo limit reached"):
        claim("c")  # a new visitor, but the global cap is reached
    asyncio.run(counter.refund("b"))
    claim("c")  # the refund freed one run


def test_redis_counter_refuses_and_undoes_the_count_over_the_cap(monkeypatch):
    monkeypatch.setattr(limits, "DAILY_RUN_CAP", 3)
    sent: list[list[str]] = []

    async def fake_send(self, *commands):
        sent.extend(commands)
        return [4, 1, 1, 1]  # Redis says: this was the 4th run today

    monkeypatch.setattr(limits.RedisCounter, "_send", fake_send)
    with pytest.raises(limits.LimitReached, match="Demo limit reached"):
        asyncio.run(limits.RedisCounter().claim("203.0.113.9"))
    assert [c[0] for c in sent] == ["INCR", "INCR", "EXPIRE", "EXPIRE", "DECR", "DECR"]
    assert "203.0.113.9" not in " ".join(sent[1])  # the IP itself is never sent to Redis


def test_no_redis_in_production_refuses_every_run(monkeypatch):
    monkeypatch.setattr(limits, "APP_ENV", "production")
    monkeypatch.setattr(limits, "REDIS_URL", "")
    counter = limits.make_counter()
    with pytest.raises(limits.LimitReached, match="not available"):
        asyncio.run(counter.claim("a"))


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(limits, "APP_ENV", "dev")  # bot check off
    monkeypatch.setattr(app_module, "counter", limits.RunCounter())
    return TestClient(app_module.app)


def test_run_rejects_bad_input_before_any_model_call(client):
    long = "x" * 300
    assert client.post("/api/run", data={"jd_text": long}).status_code == 422
    assert client.post("/api/run", data={"resume_text": long, "jd_text": "short"}).status_code == 422
    too_long = "x" * (limits.MAX_JD_CHARS + 1)
    assert client.post("/api/run", data={"resume_text": long, "jd_text": too_long}).status_code == 413
    not_pdf = {"resume_file": ("cv.pdf", b"MZ not a pdf", "application/pdf")}
    assert client.post("/api/run", data={"jd_text": long}, files=not_pdf).status_code == 415


def test_run_is_blocked_without_a_bot_check_in_production(client, monkeypatch):
    monkeypatch.setattr(limits, "APP_ENV", "production")
    monkeypatch.setattr(limits, "TURNSTILE_SECRET", "")
    response = client.post("/api/run", data={"resume_text": "x" * 300, "jd_text": "y" * 300})
    assert response.status_code == 403


def test_owner_key_skips_the_limits_and_nothing_else_does(client, monkeypatch):
    # A saved run is replayed, so no model is called. Every claim is refused.
    monkeypatch.setattr(app_module, "REPLAY_FILE", "web/public/example.json")
    monkeypatch.setattr(app_module, "counter", limits.ClosedCounter())
    monkeypatch.setattr(limits, "OWNER_KEY", "s3cret-owner-key")
    body = {"resume_text": "x" * 300, "jd_text": "y" * 300}

    def status(headers: dict) -> int:
        return client.post("/api/run", data=body, headers=headers).status_code

    assert status({}) == 429
    assert status({"x-owner-key": "wrong"}) == 429
    assert status({"x-owner-key": "s3cret-owner-key"}) == 200
    monkeypatch.setattr(limits, "OWNER_KEY", "")  # no key configured
    assert status({"x-owner-key": ""}) == 429  # an empty header must not match


def test_pdf_endpoint_returns_a_pdf_and_its_page_count(client):
    response = client.post("/api/pdf", json=make_doc(2).model_dump())
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
    assert response.headers["x-page-count"] == "1"


# --- The redesign: codes instead of sentences, status, paused, replay ---------


def test_empty_contact_items_are_dropped_on_screen_and_in_the_pdf():
    assert clean_contact("Pune |  | meera@example.com | ") == "Pune | meera@example.com"
    assert clean_contact(" | • | ") == ""  # nothing but gaps: the line goes
    # The name line is kept as written; the contact line under it is cleaned.
    text = "Meera Kulkarni\nPune |  | meera@example.com |\n\nExperience\n• Served 1,200,000 requests a day\n"
    assert split_header(text) == ["Meera Kulkarni", "Pune | meera@example.com"]
    # /api/pdf renders what the browser sends, so it cleans the header again.
    doc = ResumeDoc(header=["Meera Kulkarni", "Pune |  | meera@example.com |", " | "], links=[], sections=[])
    data, _ = render_pdf(doc)
    with pymupdf.open(stream=data, filetype="pdf") as pdf:
        printed = " ".join(pdf[0].get_text().split())  # join the lines PyMuPDF splits
    assert "Pune | meera@example.com" in printed
    assert "| |" not in printed and not printed.endswith("|")


def make_session() -> Session:
    entry = Entry(title="Software Engineer", organization="Lakeshore")
    return Session(
        evidence={"E1": EvidenceLine(id="E1", section="Experience", entry=entry, text="Cut response time to 150 ms")},
        requirements={"R1": Requirement(id="R1", text="Redis", priority="must_have")},
        links=[],
        ask_user=lambda question: "",
    )


def step(tool: str, decision: str, given: dict, out: dict, ms: int = 0) -> TraceStep:
    return TraceStep(step=1, tool=tool, input=given, output=out, decision=decision, latency_ms=ms)


def test_steps_are_sent_as_kinds_and_texts_never_as_ids():
    session = make_session()
    cases = [
        (step("parse_resume", "parsed", {}, {"items": 13}), {"kind": "read_resume", "count": 13}),
        (step("agent", "call 3 tools", {"turn": 1}, {"calls": ["search_evidence", "search_evidence", "ask_user"]}),
         {"kind": "plan", "calls": {"search_evidence": 2, "ask_user": 1}}),
        (step("search_evidence", "evidence found", {"requirement_id": "R1"}, {"evidence_ids": ["E1"]}),
         {"kind": "match_found", "requirement": "Redis", "count": 1}),
        (step("search_evidence", "gap", {"requirement_id": "R1"}, {"evidence_ids": []}),
         {"kind": "match_missing", "requirement": "Redis"}),
        (step("reject_requirement", "reject", {"requirement_id": "R1", "reason": "x"}, {"status": "gap"}),
         {"kind": "match_missing", "requirement": "Redis"}),
        (step("rewrite_bullet", "rewritten", {"evidence_ids": ["E1"]}, {"bullet_id": "B1", "text": "Cut it"}),
         {"kind": "rewrote", "before": "Cut response time to 150 ms", "after": "Cut it"}),
        (step("rewrite_bullet", "keep original", {"evidence_ids": ["E1"]}, {"status": "unchanged"}),
         {"kind": "kept", "before": "Cut response time to 150 ms"}),
        (step("verify_claim", "retry", {"bullet_id": "B1"}, {"passed": False, "violations": ["x"]}),
         {"kind": "check_failed"}),
        (step("ask_user", "no answer", {"question": "Which cache?", "requirement_id": "R1"}, {"answer": ""}),
         {"kind": "asked", "question": "Which cache?"}),
        (step("rewrite_bullet", "refused", {"evidence_ids": ["E9"]}, {"error": "Unknown IDs: E9."}),
         {"kind": "refused"}),
        (step("assemble_resume", "assembled", {"bullet_ids": ["B1"]}, {"ok": True, "bullets_used": 1}),
         {"kind": "assembled", "count": 1}),
    ]
    for trace_step, expected in cases:
        described = describe_step(trace_step, session)
        assert described == {"n": 1, "ms": 0, **expected}
        # No value is an ID like E1, B1 or R1: the browser gets texts only.
        assert not re.search(r'"[EBRU]\d+"', json.dumps(described))


def test_steps_of_one_tool_call_arrive_together():
    trace = [
        step("parse_resume", "parsed", {}, {"items": 1}, 3000),
        step("parse_jd", "parsed", {}, {"items": 1}, 2000),
        step("agent", "call 3 tools", {"turn": 1}, {"calls": []}, 10_000),
        step("search_evidence", "gap", {}, {}, 100),
        step("search_evidence", "gap", {}, {}, 100),
        step("reject_requirement", "reject", {}, {}, 0),
    ]
    # Both parse steps land when parsing ends; both searches when the search ends.
    assert arrival_times(trace) == [5000, 5000, 15_000, 15_200, 15_200, 15_200]


def test_result_lists_the_questions_the_agent_asked():
    session = make_session()
    session.assemble_fallback()  # builds session.resume in code, with no model call
    session.log("ask_user", {"question": "Which cache did you use?", "requirement_id": "R1"}, {}, "no answer")
    session.log("ask_user", {"question": "Refused one", "requirement_id": "R9"}, {}, "refused")
    result = build_result(session, ["Meera"], 1.0)
    assert result["questions"] == ["Which cache did you use?"]  # a refused call was never asked


def test_the_saved_run_is_a_whole_run_in_the_format_the_api_sends():
    saved = json.loads(Path("web/public/example.json").read_text())
    steps, stats = saved["steps"], saved["result"]["stats"]
    assert [s["n"] for s in steps] == list(range(1, stats["steps"] + 1))
    assert all("title" not in s and s["kind"] != "other" for s in steps)
    # The step times add up to the run's own length, to within a rounding.
    assert abs(steps[-1]["at"] / 1000 - stats["seconds"]) < 0.1
    assert [s["at"] for s in steps] == sorted(s["at"] for s in steps)
    assert len(saved["jd_text"]) > limits.MIN_CHARS
    # A fictional person only. A real resume must never be saved here.
    assert saved["result"]["header"][0] == "Meera Kulkarni"


def events(response) -> list[tuple[str, dict]]:
    """The (event, data) pairs in a streamed response."""
    found = re.findall(r"event: (.+)\ndata: (.+)\n\n", response.text)
    return [(name, json.loads(data)) for name, data in found]


def test_errors_carry_a_code_the_browser_can_put_words_to(client, monkeypatch):
    long = "x" * 300

    def code(**kwargs) -> str:
        return client.post("/api/run", **kwargs).json()["code"]

    assert code(data={"jd_text": long}) == "resume_too_short"
    assert code(data={"resume_text": long, "jd_text": "short"}) == "job_too_short"
    assert code(data={"resume_text": long, "jd_text": "x" * (limits.MAX_JD_CHARS + 1)}) == "job_too_long"
    not_pdf = {"resume_file": ("cv.pdf", b"MZ not a pdf", "application/pdf")}
    assert code(data={"jd_text": long}, files=not_pdf) == "file_not_pdf"
    big = {"resume_file": ("cv.pdf", b"%PDF" + b"0" * limits.MAX_FILE_BYTES, "application/pdf")}
    assert code(data={"jd_text": long}, files=big) == "file_too_big"
    # A PDF with no text in it, as a scan would be.
    blank = pymupdf.open()
    blank.new_page()
    scan = {"resume_file": ("scan.pdf", blank.tobytes(), "application/pdf")}
    assert code(data={"jd_text": long}, files=scan) == "file_no_text"
    monkeypatch.setattr(limits, "APP_ENV", "production")
    monkeypatch.setattr(limits, "TURNSTILE_SECRET", "")
    assert code(data={"resume_text": long, "jd_text": long}) == "bot_check"


def test_limit_codes_tell_the_site_cap_from_the_visitors_own_limit(monkeypatch):
    monkeypatch.setattr(limits, "RUNS_PER_IP", 1)
    monkeypatch.setattr(limits, "DAILY_RUN_CAP", 2)
    counter = limits.RunCounter()
    asyncio.run(counter.claim("a"))
    with pytest.raises(limits.LimitReached) as mine:
        asyncio.run(counter.claim("a"))
    assert mine.value.code == "limit_visitor"
    asyncio.run(counter.claim("b"))
    with pytest.raises(limits.LimitReached) as everyone:
        asyncio.run(counter.claim("a"))  # both limits hit: the site cap is the reason
    assert everyone.value.code == "limit_site"


def test_status_says_open_limited_or_paused_without_counting_a_run(client, monkeypatch):
    monkeypatch.setattr(limits, "DAILY_RUN_CAP", 1)
    monkeypatch.setattr(app_module, "STATUS_TTL_SECONDS", 0)  # no remembering: ask every time
    counter = limits.RunCounter()
    monkeypatch.setattr(app_module, "counter", counter)

    def runs() -> str:
        return client.get("/api/status").json()["runs"]

    assert runs() == "open"
    assert counter.total == 0  # asking does not use a run
    asyncio.run(counter.claim("a"))
    assert runs() == "limited"
    monkeypatch.setattr(app_module, "counter", limits.ClosedCounter())
    assert runs() == "paused"  # production with no Redis: fail closed, and say so


def test_status_asks_the_counter_once_however_often_it_is_asked(client, monkeypatch):
    asked = 0

    class CountingCounter(limits.RunCounter):
        async def state(self) -> str:
            nonlocal asked
            asked += 1
            return await super().state()

    monkeypatch.setattr(app_module, "counter", CountingCounter())
    monkeypatch.setattr(app_module, "_status_memo", None)  # nothing remembered yet
    for _ in range(25):  # as a script hammering the address would
        assert client.get("/api/status").json() == {"runs": "open"}
    assert asked == 1  # the other 24 answers came from memory, not from Redis


def test_redis_status_reads_the_total_and_fails_closed(monkeypatch):
    monkeypatch.setattr(limits, "DAILY_RUN_CAP", 3)
    sent: list[list[str]] = []

    async def fake_send(self, *commands):
        sent.extend(commands)
        return ["3"]  # Redis returns the count as text

    monkeypatch.setattr(limits.RedisCounter, "_send", fake_send)
    assert asyncio.run(limits.RedisCounter().state()) == "limited"
    assert [c[0] for c in sent] == ["GET"]  # a read: nothing is counted or stored

    async def broken_send(self, *commands):
        raise limits.httpx.ConnectError("no route")

    monkeypatch.setattr(limits.RedisCounter, "_send", broken_send)
    assert asyncio.run(limits.RedisCounter().state()) == "paused"


@pytest.mark.parametrize("switch", ["DEMO_PAUSED", "IS_PREVIEW"])
def test_a_paused_site_or_a_preview_never_starts_a_run(client, monkeypatch, switch):
    counter = limits.RunCounter()
    monkeypatch.setattr(app_module, "counter", counter)
    monkeypatch.setattr(limits, switch, True)

    async def must_not_run(token, ip):
        raise AssertionError("the bot check ran although live runs are off")

    monkeypatch.setattr(limits, "passes_bot_check", must_not_run)
    response = client.post("/api/run", data={"resume_text": "x" * 300, "jd_text": "y" * 300})
    assert (response.status_code, response.json()["code"]) == (503, "paused")
    assert counter.total == 0  # nothing was taken from the day's runs
    assert client.get("/api/status").json()["runs"] == "paused"


def test_a_model_account_problem_pauses_and_other_failures_ask_to_retry(client, monkeypatch):
    counter = limits.RunCounter()
    monkeypatch.setattr(app_module, "counter", counter)
    body = {"resume_text": "x" * 300, "jd_text": "y" * 300}

    def failing_with(error: Exception) -> tuple[str, dict]:
        def start_session(*args):
            raise error

        monkeypatch.setattr(app_module, "start_session", start_session)
        return events(client.post("/api/run", data=body))[-1]  # the stream's last event

    out_of_credit = APIError(429, {"error": {"status": "RESOURCE_EXHAUSTED", "message": "quota"}})
    assert failing_with(out_of_credit) == ("failed", {"code": "paused", "message": limits.UNAVAILABLE_MESSAGE})
    overloaded = APIError(503, {"error": {"status": "UNAVAILABLE", "message": "busy"}})
    assert failing_with(overloaded)[1]["code"] == "model_error"
    leaky = failing_with(ValueError("resume text must not leak"))
    assert leaky[1]["code"] == "model_error" and "leak" not in json.dumps(leaky)
    assert counter.total == 0  # every one of these runs was given back


def test_replay_streams_the_saved_run_in_the_new_format(client, monkeypatch):
    monkeypatch.setattr(app_module, "REPLAY_FILE", "web/public/example.json")
    monkeypatch.setattr(app_module, "REPLAY_STEP_SECONDS", 0)  # no pauses in a test
    got = events(client.post("/api/run", data={"resume_text": "x" * 300, "jd_text": "y" * 300}))
    assert got[0] == ("status", {"code": "started"})
    assert [name for name, _ in got[1:-1]] == ["step"] * 30
    assert got[-1][0] == "done" and got[-1][1]["questions"] == []
