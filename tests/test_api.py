"""Tests for the web API's own code: redaction, limits, rendering. No model is called."""

import pymupdf
import pytest
from fastapi.testclient import TestClient

from resume_agent.api import app as app_module, limits
from resume_agent.api.redact import redact, restore
from resume_agent.api.render import ResumeDoc, render_pdf, split_header
from resume_agent.models import Entry, EvidenceLine

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
    entry = Entry(title="Software Engineer", organization="Lakeshore")
    evidence = [
        EvidenceLine(id="E1", section="Experience", entry=entry, text="Served 1,200,000 requests a day")
    ]
    assert split_header(RESUME, evidence) == [
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
    counter.claim("a")
    counter.claim("a")
    with pytest.raises(limits.LimitReached, match="your 2 runs"):
        counter.claim("a")
    counter.claim("b")
    with pytest.raises(limits.LimitReached, match="Today's free runs"):
        counter.claim("c")  # a new visitor, but the global cap is reached
    counter.refund("b")
    counter.claim("c")  # the refund freed one run


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


def test_pdf_endpoint_returns_a_pdf_and_its_page_count(client):
    response = client.post("/api/pdf", json=make_doc(2).model_dump())
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
    assert response.headers["x-page-count"] == "1"
