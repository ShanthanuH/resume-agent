"""Offline tests. The model is faked, so these test the code-side guarantees only."""

import pymupdf
import pytest

from resume_agent import llm, parsing, tools
from resume_agent.extract import extract_resume_pdf
from resume_agent.models import Entry, EvidenceLine, Requirement

RESUME = """Experience
Backend Engineer    Jan 2022 - Present
Acme Corp
- Built a FastAPI service handling 2M requests per day,
  cutting p95 latency by 40%
- Led migration of 12 services to Kubernetes
"""


def fake_llm(monkeypatch, reply):
    """Make generate_structured return `reply` instead of calling Gemini."""
    monkeypatch.setattr(llm, "generate_structured", lambda **kwargs: reply)


def test_is_verbatim_ignores_whitespace_only():
    # The bullet wraps over two lines in RESUME; the joined form must still match.
    assert parsing.is_verbatim("requests per day, cutting p95 latency by 40%", RESUME)
    assert not parsing.is_verbatim("cutting p95 latency by 50%", RESUME)


# The resume used to be split by the model, and these two tests checked that
# its invented lines and fields were thrown away. The split is now done by
# code, with no model call, so they check the same guarantees on that.


def test_parse_resume_keeps_only_verbatim_lines_and_assigns_ids(monkeypatch):
    def no_model(**kwargs):
        raise AssertionError("parse_resume must not call the model")

    monkeypatch.setattr(llm, "generate_structured", no_model)
    lines = parsing.parse_resume(RESUME)
    # The wrapped bullet is one line; IDs run in resume order with no gaps.
    assert [(e.id, e.text) for e in lines] == [
        ("E1", "Built a FastAPI service handling 2M requests per day, cutting p95 latency by 40%"),
        ("E2", "Led migration of 12 services to Kubernetes"),
    ]
    # The spec's test: every text is a substring of the input.
    assert all(parsing.is_verbatim(e.text, RESUME) for e in lines)


def test_parse_resume_takes_entry_fields_from_the_resume():
    entry = parsing.parse_resume(RESUME)[0].entry
    assert entry.title == "Backend Engineer"
    assert entry.organization == "Acme Corp"
    assert entry.dates == "Jan 2022 - Present"
    for value in (entry.title, entry.organization, entry.dates):
        assert parsing.is_verbatim(value, RESUME)


def test_parse_jd_assigns_ids_in_order(monkeypatch):
    fake_llm(
        monkeypatch,
        parsing._JDDraft(
            requirements=[
                parsing._RequirementDraft(text="Python", priority="must_have"),
                parsing._RequirementDraft(text="FastAPI", priority="nice_to_have"),
            ]
        ),
    )
    reqs = parsing.parse_jd("We need Python. FastAPI is a plus.")
    assert [(r.id, r.status) for r in reqs] == [("R1", "pending"), ("R2", "pending")]


EVIDENCE = [
    EvidenceLine(id="E1", section="Experience", entry=Entry(), text="Used Python"),
    EvidenceLine(id="E2", section="Experience", entry=Entry(), text="Used FastAPI"),
]
REQ = Requirement(id="R1", text="Python", priority="must_have")


def test_search_all_evidence_only_returns_real_ids(monkeypatch):
    req2 = Requirement(id="R2", text="Go", priority="must_have")
    fake_llm(
        monkeypatch,
        tools._MatchBatchDraft(
            matches=[
                # E9 does not exist and E1 is repeated.
                tools._MatchDraft(requirement_id="R1", evidence_ids=["E1", "E9", "E1"]),
                # R7 was never asked about.
                tools._MatchDraft(requirement_id="R7", evidence_ids=["E2"]),
            ]
        ),
    )
    # R2 was left out by the model, so it must come back as "no evidence".
    assert tools.search_all_evidence([REQ, req2], EVIDENCE) == {"R1": ["E1"], "R2": []}


def test_search_all_evidence_caps_matches(monkeypatch):
    many = [
        EvidenceLine(id=f"E{n}", section="Experience", entry=Entry(), text="Python")
        for n in range(1, 8)
    ]
    fake_llm(
        monkeypatch,
        tools._MatchBatchDraft(
            matches=[
                tools._MatchDraft(
                    requirement_id="R1", evidence_ids=[e.id for e in many]
                )
            ]
        ),
    )
    assert tools.search_evidence(REQ, many) == ["E1", "E2", "E3"]


def test_rewrite_bullets_bookkeeping_comes_from_code(monkeypatch):
    fake_llm(
        monkeypatch,
        tools._BulletBatchDraft(
            bullets=[
                # The model points `replaces` at a line this job was never given.
                tools._BulletDraft(bullet_id="B1", text="Wrote Python", replaces="E2"),
                # The model invents a job that was never asked for.
                tools._BulletDraft(bullet_id="B9", text="Led a team", replaces=None),
            ]
        ),
    )
    jobs = [
        tools.RewriteJob(bullet_id="B1", sources=[EVIDENCE[0]], requirements=[REQ]),
        tools.RewriteJob(bullet_id="B2", sources=[EVIDENCE[1]], requirements=[REQ]),
    ]
    bullets = tools.rewrite_bullets(jobs)
    # B9 is ignored, and B2 is absent because the model never answered it.
    assert [b.id for b in bullets] == ["B1"]
    assert bullets[0].source_ids == ["E1"]
    assert bullets[0].requirement_ids == ["R1"]
    assert bullets[0].replaces is None
    assert bullets[0].status == "proposed"


def test_rewrite_bullet_refuses_without_sources():
    with pytest.raises(ValueError):
        tools.rewrite_bullet([], [REQ], bullet_id="B1")


def test_rewrite_bullet_raises_when_model_returns_nothing(monkeypatch):
    fake_llm(monkeypatch, tools._BulletBatchDraft(bullets=[]))
    with pytest.raises(ValueError):
        tools.rewrite_bullet([EVIDENCE[0]], [REQ], bullet_id="B1")


def test_extract_resume_pdf_returns_text_and_links(tmp_path):
    # Build a tiny PDF with one line of text and one link over it.
    path = tmp_path / "resume.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "GitHub profile")
    page.insert_link(
        {
            "kind": pymupdf.LINK_URI,
            "from": pymupdf.Rect(70, 60, 200, 78),
            "uri": "https://github.com/example",
        }
    )
    doc.save(path)
    doc.close()

    result = extract_resume_pdf(path)
    assert "GitHub profile" in result.text
    assert [(l.label, l.url) for l in result.links] == [
        ("GitHub profile", "https://github.com/example")
    ]
