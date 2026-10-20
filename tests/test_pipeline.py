"""The resume pipeline end to end, with no model: parse, assemble, render, read back.

The round trip: parse a resume PDF, assemble it with zero changes, render the
PDF, read it back, and compare with the original. Nothing may be lost, moved,
merged or reworded. It runs on four fictional fixtures in different layouts
(LaTeX, a Word export, Google Docs style, two columns with a sidebar), and on
the owner's resumes in ~/swooshcv-test/ when they exist.

A round trip only shows the parse is stable. The layout tests below check that
it is also right: bullets are bullets, headings are headings, entries are whole.
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
from resume_agent.extract import (
    LayoutLine,
    ResumeText,
    Span,
    extract_resume_pdf,
    split_columns,
)
from resume_agent.models import (
    Entry,
    EvidenceLine,
    HeaderLine,
    Mark,
    Styled,
    TailoredBullet,
)
from resume_agent.parsing import parse_resume
from resume_agent.session import Session
from resume_agent.structure import ParsedResume, entry_fields, parse_layout

FIXTURES = Path(__file__).parent / "fixtures"
FIXTURE = FIXTURES / "fictional_resume.pdf"  # LaTeX, one column
WORD = FIXTURES / "word_resume.pdf"  # a Word document exported by LibreOffice
GDOCS = FIXTURES / "gdocs_resume.pdf"  # laid out like Google Docs, printed by Chrome
SIDEBAR = FIXTURES / "sidebar_resume.pdf"  # LaTeX, two columns with a sidebar
# The owner's own resumes, when they are on this machine. Never committed.
OWN_RESUMES = [p for p in (Path.home() / "swooshcv-test" / n for n in ("original.pdf", "current.pdf")) if p.exists()]
EXAMPLE = Path(__file__).parent.parent / "web" / "public" / "example.json"
PDFS = [FIXTURE, WORD, GDOCS, SIDEBAR, *OWN_RESUMES]
LIGATURES = re.compile("[ﬀ-ﬆ]")
SEPARATORS = {"|", "•", "·", "●", "▪", "■", "◦"}  # separators and bullet signs, not words


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


@pytest.mark.parametrize(
    ("pdf", "heading", "urls"),
    [
        (FIXTURE, "PROJECTS", ["https://tidepool.example.com", "https://kestrel.example.org"]),
        # LibreOffice and Chrome write a bare domain with a closing slash.
        (WORD, "PROJECTS", ["https://shelf-monitor.example.com/", "https://routes.example.org/"]),
        (GDOCS, "Things I've Built", ["https://tidewatch.example.com/", "https://menumapper.example.org/"]),
        (SIDEBAR, "Projects", ["https://ledgerlite.example.com", "https://queuepeek.example.org"]),
    ],
    ids=lambda v: v.name if isinstance(v, Path) else "",
)
def test_bug2_two_live_links_keep_their_own_urls(pdf, heading, urls, tmp_path):
    _, data, _ = run_pipeline(pdf)
    rendered = read_back(data, tmp_path)
    projects = next(s for s in rendered.sections if s.heading == heading)
    live = [
        m.url
        for entry in projects.entries
        for m in entry.entry.header_lines[0].left.marks
        if m.text == "live"
    ]
    assert live == urls


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


# --- layouts -----------------------------------------------------------------------


def parsed(pdf: Path) -> ParsedResume:
    return parse_layout(extract_resume_pdf(pdf).text)


def entries_of(resume: ParsedResume, heading: str) -> list[tuple]:
    section = next(s for s in resume.sections if s.heading == heading)
    return [
        (e.entry.organization, e.entry.title, e.entry.dates, e.entry.location, [i.kind for i in e.items])
        for e in section.entries
    ]


def test_word_bullets_are_bullets():
    # Word writes its bullet as a Symbol-font character, U+F0B7 in the text layer.
    resume = parsed(WORD)
    assert "" not in extract_resume_pdf(WORD).text
    assert entries_of(resume, "WORK EXPERIENCE") == [
        ("Larkspur Analytics", "Machine Learning Engineer", "Mar 2023 – Present", "Bengaluru, India", ["bullet"] * 3),
        ("Northgate Retail", "Data Analyst", "Jul 2021 – Feb 2023", "Chennai, India", ["bullet"] * 2),
    ]


def test_google_docs_headings_subtitle_and_date_lines():
    resume = parsed(GDOCS)
    assert [h.text for h in resume.header][:2] == ["Daniel Osei", "Product Data Scientist"]
    # Bigger only: regular weight, Title Case, no rule, one not in the word list.
    assert [s.heading for s in resume.sections] == [
        "Summary", "Experience", "Things I've Built", "Education", "Skills & Tools",
    ]
    # "Company, Place — Role" with the dates on a small line of their own.
    assert entries_of(resume, "Experience") == [
        ("Brightline Health, Pune", "Senior Data Analyst", "JAN 2022 – PRESENT", "", ["bullet"] * 3),
        ("Kitepost, Remote", "Data Analyst", "JUN 2019 – DEC 2021", "", ["bullet"] * 2),
    ]
    assert entries_of(resume, "Education")[0][2] == "2016 – 2019"


def test_a_sidebar_layout_is_read_one_column_at_a_time():
    resume = parsed(SIDEBAR)
    assert [h.text for h in resume.header] == ["Sara Fernandes", "Backend Engineer"]
    # The left column, then the right one; never two columns run into one line.
    assert [s.heading for s in resume.sections] == [
        "Contact", "Skills", "Education", "Languages", "Summary", "Experience", "Projects",
    ]
    contact = resume.sections[0].entries[0].items
    assert [i.text.text for i in contact] == [
        "Goa, India", "+91-90000-33333", "sara.fernandes@example.com", "github.com/sara-f-example",
    ]
    assert entries_of(resume, "Education") == [
        ("Goa University", "B.E., Information Technology", "2015 – 2019", "", []),
    ]
    assert entries_of(resume, "Experience")[0][:4] == (
        "Harbourline Payments", "Senior Backend Engineer", "2021 – Present", "Bengaluru",
    )


def span(text: str, x0: float, x1: float, size: float = 10, bold: bool = False) -> Span:
    return Span(text=text, x0=x0, x1=x1, size=size, bold=bold)


def test_dates_close_to_a_long_name_are_still_the_right_column():
    # Measured on a real resume: a long organisation name leaves 12 pt before
    # its dates, under the 2.5 font sizes a column gap needs on its own.
    full = LayoutLine(left=[span("A line that reaches the right edge of the text", 32.4, 562.9)], top=170, bottom=180)
    close = LayoutLine(
        left=[span("Institute of Technology – Centre of Excellence in Manufacturing ", 32.4, 458.7, bold=True),
              span("Jun 2024 – Sep 2025", 470.8, 562.9)],
        top=185, bottom=195,
    )
    # Justified text stretches every gap alike, so no one gap is a column.
    justified = LayoutLine(
        left=[span("Built the reporting", 32.4, 150), span("tool for finance", 162, 300),
              span("teams across", 312, 450), span("regions", 462, 562.9)],
        top=200, bottom=210,
    )
    split_columns([full, close, justified])
    assert "".join(s.text for s in close.right) == "Jun 2024 – Sep 2025"
    assert justified.right == []


def test_a_bullet_that_wraps_early_is_still_one_bullet():
    # "...at" + "120 ms inference": "120 ms" moves down as one word (a
    # non-breaking space), so the line above ends 24 pt short of the edge.
    lines = [
        LayoutLine(left=[span("Asha Rao", 32.4, 120, size=16, bold=True)], top=40, bottom=56),
        LayoutLine(left=[span("EXPERIENCE", 32.4, 100, size=12, bold=True)], top=140, bottom=152, rule_below=True),
        LayoutLine(left=[span("Acme Labs", 32.4, 90, bold=True)], right=[span("Jun 2024 – Sep 2025", 470.8, 562.9)], top=158, bottom=168),
        LayoutLine(left=[span("• ", 37.1, 41.3, size=8), span("Built a detection pipeline on noisy images, reaching 98.4% accuracy at", 46.8, 538.5)], top=172, bottom=182),
        LayoutLine(left=[span("120 ms ", 46.8, 80.4, bold=True), span("inference on plant hardware", 83.2, 220)], top=184.5, bottom=194.5),
        LayoutLine(left=[span("• ", 37.1, 41.3, size=8), span("Cut latency by 60%", 46.8, 140)], top=197, bottom=207),
    ]
    resume = parse_layout(ResumeText(lines))
    items = resume.sections[0].entries[0].items
    assert [i.kind for i in items] == ["bullet", "bullet"]
    assert items[0].text.text.endswith("accuracy at 120 ms inference on plant hardware")


def test_a_labelled_skills_row_under_a_full_one_is_its_own_row():
    # The first row ends 15 pt short of the edge, where "ML:" would just about
    # fit: by width alone it looks wrapped.
    lines = [
        LayoutLine(left=[span("Asha Rao", 32.4, 120, size=16, bold=True)], top=40, bottom=56),
        LayoutLine(left=[span("TECHNICAL SKILLS", 32.4, 150, size=12, bold=True)], top=730, bottom=742, rule_below=True),
        LayoutLine(left=[span("AI & LLMs: ", 43.2, 93.8, bold=True), span("AI agents, RAG, embeddings, semantic search, LLM evaluation", 97.3, 547.3)], top=749, bottom=759),
        LayoutLine(left=[span("ML: ", 43.2, 60.8, bold=True), span("PyTorch, OpenCV, CNNs", 63.6, 315.1)], top=761, bottom=771),
        LayoutLine(left=[span("Tools: ", 43.2, 70.6, bold=True), span("A tool row that reaches the right edge of the text", 74.0, 562.9)], top=773, bottom=783),
    ]
    rows = parse_layout(ResumeText(lines)).sections[0].entries[0].items
    assert [r.text.text.split(":")[0] for r in rows] == ["AI & LLMs", "ML", "Tools"]


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
