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


def draft_line(text, title="Backend Engineer", organization="Acme Corp"):
    return parsing._LineDraft(
        section="Experience",
        entry=parsing._EntryDraft(
            title=title, organization=organization, dates="Jan 2022 - Present"
        ),
        text=text,
    )


def test_is_verbatim_ignores_whitespace_only():
    # The bullet wraps over two lines in RESUME; the joined form must still match.
    assert parsing.is_verbatim("requests per day, cutting p95 latency by 40%", RESUME)
    assert not parsing.is_verbatim("cutting p95 latency by 50%", RESUME)


def test_parse_resume_keeps_only_verbatim_lines_and_assigns_ids(monkeypatch):
    fake_llm(
        monkeypatch,
        parsing._ResumeDraft(
            lines=[
                draft_line("Led migration of 12 services to Kubernetes"),
                draft_line("Led migration of 20 services to Kubernetes"),  # invented
                draft_line(
                    "Built a FastAPI service handling 2M requests per day, "
                    "cutting p95 latency by 40%"
                ),
            ]
        ),
    )
    lines = parsing.parse_resume(RESUME)
    # The invented line is gone and IDs have no gap where it was.
    assert [e.id for e in lines] == ["E1", "E2"]
    # The spec's test: every text is a substring of the input.
    assert all(parsing.is_verbatim(e.text, RESUME) for e in lines)


def test_parse_resume_blanks_entry_fields_not_in_resume(monkeypatch):
    fake_llm(
        monkeypatch,
        parsing._ResumeDraft(
            lines=[
                draft_line(
                    "Led migration of 12 services to Kubernetes",
                    title="Senior Staff Engineer",  # not in the resume
                )
            ]
        ),
    )
    entry = parsing.parse_resume(RESUME)[0].entry
    assert entry.title == ""
    assert entry.organization == "Acme Corp"


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


def test_search_evidence_drops_unknown_and_duplicate_ids(monkeypatch):
    fake_llm(monkeypatch, tools._MatchDraft(evidence_ids=["E1", "E9", "E1"]))
    assert tools.search_evidence(REQ, EVIDENCE) == ["E1"]


def test_rewrite_bullet_bookkeeping_comes_from_code(monkeypatch):
    # The model points `replaces` at a line it was never given.
    fake_llm(monkeypatch, tools._BulletDraft(text="Wrote Python", replaces="E2"))
    bullet = tools.rewrite_bullet([EVIDENCE[0]], [REQ], bullet_id="B1")
    assert bullet.source_ids == ["E1"]
    assert bullet.requirement_ids == ["R1"]
    assert bullet.replaces is None
    assert bullet.status == "proposed"


def test_rewrite_bullet_refuses_without_sources():
    with pytest.raises(ValueError):
        tools.rewrite_bullet([], [REQ], bullet_id="B1")


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
