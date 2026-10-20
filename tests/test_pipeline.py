"""The resume pipeline end to end, with no model: parse, assemble, render, read back.

The round trip: parse a resume PDF, assemble it with zero changes, render the
PDF, read it back, and compare with the original. Nothing may be lost, moved,
merged or reworded. It runs on a fictional fixture made with LaTeX, and on
~/swooshcv-test/original.pdf when that file exists.
"""

import json
import logging
import re
from pathlib import Path

import pymupdf
import pytest

from resume_agent.api.payload import build_result, restore_all
from resume_agent.api.redact import redact
from resume_agent.api.render import ResumeDoc, doc_from_result, header_lines, render_pdf
from resume_agent.assemble import build_resume, check_resume
from resume_agent.extract import extract_resume_pdf
from resume_agent.models import Entry, EvidenceLine, HeaderLine, Mark, Styled, TailoredBullet
from resume_agent.parsing import parse_resume
from resume_agent.session import Session
from resume_agent.structure import ParsedResume, entry_fields, parse_layout

FIXTURE = Path(__file__).parent / "fixtures" / "fictional_resume.pdf"
OWN_RESUME = Path.home() / "swooshcv-test" / "original.pdf"
EXAMPLE = Path(__file__).parent.parent / "web" / "public" / "example.json"
PDFS = [FIXTURE] + ([OWN_RESUME] if OWN_RESUME.exists() else [])
LIGATURES = re.compile("[ﬀ-ﬆ]")
SEPARATORS = {"|", "•", "·"}  # printed between items, not words of the resume


def run_pipeline(pdf: Path, bullets: list[TailoredBullet] = ()) -> tuple[ParsedResume, bytes, dict]:
    """The live site's path, with no model: redact, parse, assemble, render."""
    extracted = extract_resume_pdf(pdf)
    safe, found = redact(extracted.text)
    evidence = parse_resume(safe)
    session = Session(
        evidence={e.id: e for e in evidence},
        requirements={},
        links=extracted.links,
        ask_user=lambda question: "",
    )
    session.resume = build_resume(evidence, list(bullets), extracted.links)
    session.bullets = {b.id: b for b in bullets}
    result = restore_all(build_result(session, header_lines(safe), 0.0), found)
    data, pages = render_pdf(doc_from_result(result))
    assert pages == 1
    return parse_layout(extracted.text), data, result


def read_back(data: bytes, tmp_path: Path) -> ParsedResume:
    path = tmp_path / "rendered.pdf"
    path.write_bytes(data)
    return parse_layout(extract_resume_pdf(path).text)


def words(parsed_text: str) -> list[str]:
    return [w for w in parsed_text.split() if w not in SEPARATORS]


def link_places(parsed: ParsedResume) -> list[tuple]:
    """Every link as (where it is, its words, which occurrence, its URL)."""
    places = [("header", m.text, m.url) for h in parsed.header for m in h.marks if m.url]
    for s, section in enumerate(parsed.sections):
        for e, entry in enumerate(section.entries):
            for h, header in enumerate(entry.entry.header_lines):
                for side, styled in (("left", header.left), ("right", header.right)):
                    places += [(s, e, "header", h, side, m.text, m.n, m.url) for m in styled.marks if m.url]
            for i, item in enumerate(entry.items):
                places += [(s, e, "item", i, m.text, m.n, m.url) for m in item.text.marks if m.url]
    return places


def structure(parsed: ParsedResume) -> list:
    """Headings, entry header lines (left and right text) and items, in order."""
    return [
        (
            section.heading,
            [
                (
                    [(h.left.text, h.right.text) for h in entry.entry.header_lines],
                    [(item.kind, item.join, item.text.text) for item in entry.items],
                )
                for entry in section.entries
            ],
        )
        for section in parsed.sections
    ]


# --- round trip ----------------------------------------------------------------


@pytest.mark.parametrize("pdf", PDFS, ids=lambda p: p.name)
def test_round_trip_keeps_every_word_line_and_link(pdf, tmp_path):
    original, data, _ = run_pipeline(pdf)
    rendered = read_back(data, tmp_path)
    source = extract_resume_pdf(pdf).text
    # Every non-empty line survives, in order. Wrapping is ignored: the words
    # are compared as one sequence.
    printed = extract_resume_pdf(tmp_path / "rendered.pdf").text
    assert words(printed) == words(source)
    # The same header, the same sections under the same headings, the same
    # entry header lines with their dates and places, the same items.
    assert [h.text for h in rendered.header][0] == original.header[0].text
    assert structure(rendered) == structure(original)
    # Every link on the same words, at the same place, to the same URL.
    assert link_places(rendered) == link_places(original)


@pytest.mark.parametrize("pdf", PDFS, ids=lambda p: p.name)
def test_each_date_range_stays_on_one_line(pdf, tmp_path):
    original, data, _ = run_pipeline(pdf)
    read_back(data, tmp_path)
    printed = extract_resume_pdf(tmp_path / "rendered.pdf").text.layout
    rights = {"".join(s.text for s in line.right).strip() for line in printed}
    for section in original.sections:
        for entry in section.entries:
            for header in entry.entry.header_lines:
                if header.right.text:
                    assert header.right.text in rights  # whole, on one printed line


@pytest.mark.parametrize("pdf", PDFS, ids=lambda p: p.name)
def test_rendered_pdf_has_no_ligature_characters(pdf):
    _, data, _ = run_pipeline(pdf)
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        text = doc[0].get_text()  # PyMuPDF keeps ligature characters by default
    assert not LIGATURES.search(text)


def test_plain_search_finds_words_with_fi_and_fl():
    _, data, _ = run_pipeline(FIXTURE)
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        text = doc[0].get_text()
    for word in ("verification", "Certified", "classifier", "flight", "workflow", "profiling", "efficient"):
        assert word in text


@pytest.mark.parametrize("pdf", PDFS, ids=lambda p: p.name)
def test_parser_needs_no_fallback_on_the_fixtures(pdf, caplog):
    with caplog.at_level(logging.WARNING, logger="resume_agent.structure"):
        parsed = parse_layout(extract_resume_pdf(pdf).text)
    assert parsed.warnings == []
    assert not caplog.records


# --- the bugs, one by one, on the fixture ----------------------------------------


def test_bug1_summary_is_a_section_not_part_of_the_header():
    parsed = parse_layout(extract_resume_pdf(FIXTURE).text)
    assert [h.text for h in parsed.header] == [
        "Ishaan Varma",
        "Nagpur, India | +91-90000-12345 | ishaan.varma@example.com | linkedin.com/in/ishaan-varma-example |",
        "github.com/ishaan-v-example",
    ]
    summary = parsed.sections[0]
    assert (summary.heading, summary.kind) == ("SUMMARY", "summary")
    sentences = [item.text.text for item in summary.entries[0].items]
    # The last sentence is there, whole.
    assert sentences[-1] == "Comfortable profiling Python services and writing efficient SQL."


def test_bug2_two_live_links_keep_their_own_urls(tmp_path):
    _, data, _ = run_pipeline(FIXTURE)
    rendered = read_back(data, tmp_path)
    projects = next(s for s in rendered.sections if s.heading == "PROJECTS")
    live = [
        m.url
        for entry in projects.entries
        for m in entry.entry.header_lines[0].left.marks
        if m.text == "live"
    ]
    assert live == ["https://tidepool.example.com", "https://kestrel.example.org"]


def test_bug4_sections_keep_their_order_and_headings():
    original, data, result = run_pipeline(FIXTURE)
    assert [s["name"] for s in result["sections"]] == [
        "SUMMARY", "PROJECTS", "EXPERIENCE", "CERTIFICATIONS", "EDUCATION", "TECHNICAL SKILLS",
    ]


def test_bug5_locations_and_second_header_lines_are_kept():
    _, _, result = run_pipeline(FIXTURE)
    entries = {e["organization"]: e for s in result["sections"] for e in s["entries"]}
    northwind = entries["Northwind Analytics"]
    assert northwind["location"] == "Pune, India"
    assert [(h["left"]["text"], h["right"]["text"]) for h in northwind["header_lines"]] == [
        ("Northwind Analytics", "Mar 2023 – Present"),
        ("Data Engineer", "Pune, India"),
    ]
    assert entries["Harbor Labs"]["location"] == "Remote"


def test_bug7_organisation_title_bold_and_italic_survive(tmp_path):
    _, data, result = run_pipeline(FIXTURE)
    rendered = read_back(data, tmp_path)
    experience = next(s for s in rendered.sections if s.heading == "EXPERIENCE").entries[0]
    first, second = experience.entry.header_lines
    assert first.left.text == "Northwind Analytics"  # organisation first, as written
    assert any(m.bold and m.text == "Northwind Analytics" for m in first.left.marks)
    assert any(m.italic and m.text == "Data Engineer" for m in second.left.marks)
    # Bold numbers and bold skill labels come back bold.
    bold = {m.text for e in experience.items for m in e.text.marks if m.bold}
    assert {"5 hours to 3 hours", "8 analysts"} <= bold
    skills = next(s for s in rendered.sections if s.heading == "TECHNICAL SKILLS").entries[0]
    assert [m.text for item in skills.items for m in item.text.marks if m.bold] == ["Languages:", "Data:", "Tools:"]


def test_bug8_summary_sentences_are_evidence_the_agent_can_rewrite():
    evidence = parse_resume(extract_resume_pdf(FIXTURE).text)
    summary = [e for e in evidence if e.section == "SUMMARY"]
    assert [(e.id, e.kind, e.join) for e in summary] == [
        ("E1", "sentence", False),
        ("E2", "sentence", True),
        ("E3", "sentence", True),
    ]


def test_bug9_a_skill_list_is_never_the_organisation():
    def line(left: str, right: str = "") -> HeaderLine:
        return HeaderLine(left=Styled(text=left), right=Styled(text=right))

    project = entry_fields([line("Tidepool (live) | Python, FastAPI, PostgreSQL", "Jan 2025")], "projects")
    assert project.organization == ""
    # Two header lines whose second line is a stack, not an organisation.
    job = entry_fields([line("Data Engineer", "2023"), line("Python, Go, Kubernetes, Airflow")], "experience")
    assert job.organization == ""
    assert job.title == "Data Engineer"
    # A real organisation still lands in the field.
    normal = entry_fields([line("Northwind Analytics", "2023"), line("Data Engineer", "Pune, India")], "experience")
    assert (normal.organization, normal.title, normal.location) == ("Northwind Analytics", "Data Engineer", "Pune, India")


def test_entries_with_no_bullets_are_kept_and_visible_to_the_matcher():
    evidence = parse_resume(extract_resume_pdf(FIXTURE).text)
    education = [e for e in evidence if e.section == "EDUCATION"]
    # The degree has no bullets: its header lines are evidence, never rewritten.
    assert [(e.kind, e.text) for e in education] == [
        ("header", "Visvesvaraya National Institute of Technology"),
        ("header", "B.Tech, Electrical Engineering | CGPA 8.6/10"),
    ]


# --- assembly: links by position, locked lines ---------------------------------

PROJECT = Entry(title="Tidepool (live) | Python")
LINKED = EvidenceLine(
    id="E1",
    section="PROJECTS",
    entry=PROJECT,
    text="Shipped the live demo and a live API",
    marks=[Mark(text="live", n=1, url="https://api.example.com")],
)
DEGREE = EvidenceLine(id="E2", section="EDUCATION", entry=Entry(title="B.Tech"), text="B.Tech", kind="header")


def bullet(replaces: str, text: str) -> TailoredBullet:
    return TailoredBullet(id="B1", text=text, source_ids=[replaces], requirement_ids=["R1"], replaces=replaces)


def test_a_rewrite_keeps_its_link_on_the_same_occurrence():
    rewrite = bullet("E1", "Built a live demo and a live REST API")
    resume = build_resume([LINKED, DEGREE], [rewrite], [])
    line = resume.sections[0].entries[0].lines[0]
    assert (line.text, line.bullet_id) == ("Built a live demo and a live REST API", "B1")
    assert [(m.text, m.n, m.url) for m in line.marks] == [("live", 1, "https://api.example.com")]


def test_a_rewrite_that_drops_a_link_keeps_the_original_line():
    rewrite = bullet("E1", "Shipped a demo and an API")  # "live" is gone
    resume = build_resume([LINKED, DEGREE], [rewrite], [])
    line = resume.sections[0].entries[0].lines[0]
    assert (line.text, line.bullet_id) == (LINKED.text, None)
    assert resume.skipped == {"B1": "it drops a link"}
    assert check_resume(resume, [LINKED, DEGREE], [rewrite], []) == []  # skipped, not failed


def test_header_lines_are_never_rewritten():
    rewrite = bullet("E2", "B.Tech with a focus on data")
    resume = build_resume([LINKED, DEGREE], [rewrite], [])
    assert resume.sections[1].entries[0].lines == []  # drawn from the entry header only
    assert resume.skipped == {"B1": "the line is printed as written"}
    assert check_resume(resume, [LINKED, DEGREE], [rewrite], []) == []


def test_a_rewritten_summary_sentence_keeps_its_full_stop():
    _, _, result = run_pipeline(FIXTURE, [bullet("E1", "Data engineer building verification pipelines")])
    assert result["bullets"][0]["text"] == "Data engineer building verification pipelines."


# --- older shapes still render ---------------------------------------------------


def test_the_saved_replay_still_renders():
    saved = json.loads(EXAMPLE.read_text())
    doc = doc_from_result(saved["result"])
    skills = next(s for s in doc.sections if s.name == "Technical Skills")
    assert skills.entries[0].lines[0].kind == "line"  # a row, not a bullet, as before
    data, pages = render_pdf(doc)
    assert pages == 1
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        text = doc[0].get_text()
    assert "Meera Kulkarni" in text
    assert not LIGATURES.search(text)


def test_an_old_style_request_still_renders_with_dates_on_one_line():
    doc = ResumeDoc(
        header=["Meera Kulkarni", "meera@example.com"],
        links=[],
        sections=[{
            "name": "Experience",
            "entries": [{
                "title": "Software Engineer",
                "organization": "Lakeshore Logistics, a company with a very long name indeed",
                "dates": "Jul 2021 – Aug 2025",
                "lines": ["Built a shipment tracking API"],
            }],
        }],
    )
    data, pages = render_pdf(doc)
    with pymupdf.open(stream=data, filetype="pdf") as pdf:
        lines = pdf[0].get_text().splitlines()
    assert pages == 1
    assert "Jul 2021 – Aug 2025" in lines  # one line, not "Jul 2021 – Aug" and "2025"
