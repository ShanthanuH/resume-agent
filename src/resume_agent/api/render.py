"""Turn the reviewed resume into a one-page PDF, in plain Python.

The PDF is drawn by PyMuPDF from a small HTML page. No browser runs on the
server, which keeps the Docker image small and the render fast. The text stays
real text (not an image), in one column, so resume-parsing software can read it.
"""

import html
import re

import pymupdf
from pydantic import BaseModel, Field

from resume_agent.extract import Link
from resume_agent.models import EvidenceLine
from resume_agent.parsing import normalize

MAX_HEADER_LINES = 6  # name plus a few contact lines; more means we misread the top
# Font sizes to try, largest first. The first one that fits on one page wins.
FONT_SIZES = [10.5, 10.0, 9.5, 9.0, 8.5, 8.0]
MARGIN = 36  # points; 72 points make an inch, so this is half an inch

_SHORT = Field(max_length=300)  # a heading, a title, a date range
_LINE = Field(max_length=1200)  # one bullet


# What the browser sends back to be rendered. It holds the visitor's own resume
# after their accept and reject choices. Every field is length-limited because
# this endpoint takes text from the internet.
class DocEntry(BaseModel):
    title: str = _SHORT
    organization: str = _SHORT
    dates: str = _SHORT
    lines: list[str] = Field(max_length=60)


class DocSection(BaseModel):
    name: str = _SHORT
    entries: list[DocEntry] = Field(max_length=40)


class ResumeDoc(BaseModel):
    header: list[str] = Field(max_length=MAX_HEADER_LINES)
    links: list[Link] = Field(max_length=40)
    sections: list[DocSection] = Field(max_length=20)


def split_header(text: str, evidence: list[EvidenceLine]) -> list[str]:
    """The lines above the first section: the name and the contact details.

    The parser is told to skip these, so they are taken from the resume text in
    code. Reading stops at the first line that belongs to the parsed resume.
    """
    known = {
        normalize(value).lower()
        for e in evidence
        for value in (e.section, e.entry.title, e.entry.organization)
        if value
    }
    bodies = [e.text.lower() for e in evidence]
    header: list[str] = []
    for raw in text.splitlines():
        line = normalize(raw)
        if not line:
            continue
        low = line.lower()
        # A section heading, an entry title, or the start of an evidence line.
        if low in known or any(body.startswith(low) for body in bodies):
            break
        header.append(line[:300])
        if len(header) == MAX_HEADER_LINES:
            break
    return header


# A written-out URL, a bare profile path on a common site, or an email address.
_URL = re.compile(
    r"(?:https?://|www\.)[^\s|,;)]+"
    r"|\b(?:linkedin\.com|github\.com|gitlab\.com)/[^\s|,;)]+"
    r"|[\w.+-]+@[\w-]+(?:\.[\w-]+)+",
    re.IGNORECASE,
)


def _href(found: str) -> str:
    if "@" in found and "://" not in found:
        return f"mailto:{found}"
    return found if "://" in found else f"https://{found}"


def _safe(url: str) -> bool:
    """Only web and mail links. Blocks things like javascript: URLs."""
    return url.lower().startswith(("http://", "https://", "mailto:"))


class _Linker:
    """Escapes text for HTML and makes its links clickable.

    A link from the original PDF is attached to the first place its label
    appears. `used` remembers which were placed, so the rest can be listed in
    the header and no link is lost.
    """

    def __init__(self, links: list[Link]) -> None:
        self.links = [l for l in links if _safe(l.url)]
        self.used: set[str] = set()

    def html(self, text: str) -> str:
        spans: list[tuple[int, int, str]] = []  # (start, end, url) inside text
        for link in self.links:
            if link.url in self.used or len(link.label) < 2:
                continue
            start = text.find(link.label)
            if start >= 0:
                spans.append((start, start + len(link.label), link.url))
                self.used.add(link.url)
        for match in _URL.finditer(text):  # URLs and emails written out in the text
            spans.append((match.start(), match.end(), _href(match.group(0))))
        out: list[str] = []
        position = 0
        for start, end, url in sorted(spans):
            if start < position:  # overlaps a link already placed: skip it
                continue
            out.append(html.escape(text[position:start]))
            out.append(f'<a href="{html.escape(url)}">{html.escape(text[start:end])}</a>')
            position = end
        out.append(html.escape(text[position:]))
        return "".join(out)


def to_html(doc: ResumeDoc) -> str:
    """The resume as simple HTML: headings, one-row tables and bullet lists."""
    linker = _Linker(doc.links)
    name = doc.header[0] if doc.header else ""
    contact = [linker.html(line) for line in doc.header[1:]]
    body: list[str] = []
    for section in doc.sections:
        body.append(f"<h2>{html.escape(section.name)}</h2>")
        for entry in section.entries:
            heading = ", ".join(
                part
                for part in (
                    f"<b>{linker.html(entry.title)}</b>" if entry.title else "",
                    linker.html(entry.organization),
                )
                if part
            )
            if heading or entry.dates:
                # A one-row table puts the dates at the right edge of the line.
                body.append(
                    f'<table><tr><td>{heading}</td><td class="dates">'
                    f"{html.escape(entry.dates)}</td></tr></table>"
                )
            # A line that only repeats the entry title adds nothing: leave it out.
            lines = [l for l in entry.lines if normalize(l) != normalize(entry.title)]
            if heading:
                items = "".join(f"<li>{linker.html(line)}</li>" for line in lines)
                body.append(f"<ul>{items}</ul>" if items else "")
            else:  # no entry heading, e.g. a skills section: plain rows
                body.extend(f'<p class="row">{linker.html(line)}</p>' for line in lines)
    # Links whose label was not found in the text (an icon, say) go in the header.
    for link in linker.links:
        if link.url not in linker.used:
            shown = re.sub(r"^(https?://|mailto:)", "", link.url).rstrip("/")
            contact.append(f'<a href="{html.escape(link.url)}">{html.escape(shown)}</a>')
    return (
        f"<h1>{html.escape(name)}</h1>"
        f'<p class="contact">{" | ".join(contact)}</p>' + "".join(body)
    )


def _css(size: float) -> str:
    return f"""
    body {{ font-family: sans-serif; font-size: {size}pt; line-height: 1.25; }}
    h1 {{ font-size: {size * 2}pt; text-align: center; margin: 0; }}
    .contact {{ text-align: center; margin: 2pt 0 0 0; }}
    h2 {{ font-size: {size + 1}pt; margin: 7pt 0 2pt 0; border-bottom: 0.6pt solid #000;
         text-transform: uppercase; }}
    table {{ width: 100%; margin: 2pt 0 0 0; }}
    td {{ padding: 0; }}
    .dates {{ text-align: right; }}
    ul {{ margin: 0; padding-left: 12pt; }}
    li {{ margin: 0; }}
    .row {{ margin: 1pt 0 0 0; }}
    a {{ color: #000; text-decoration: none; }}
    """


def render_pdf(doc: ResumeDoc) -> tuple[bytes, int]:
    """Return the PDF and its page count. Shrinks the font until it is one page."""
    page_html = to_html(doc)
    paper = pymupdf.paper_rect("a4")
    content = paper + (MARGIN, MARGIN, -MARGIN, -MARGIN)  # the area inside the margins
    for size in FONT_SIZES:
        story = pymupdf.Story(html=page_html, user_css=_css(size))
        # The function tells PyMuPDF where each new page's text goes.
        pdf = story.write_with_links(lambda number, filled: (paper, content, None))
        if pdf.page_count == 1:
            break
    # Falls out of the loop at the smallest size if it never fitted: the caller
    # reports the real page count instead of pretending.
    data = pdf.tobytes(garbage=3, deflate=True)  # drop unused objects, compress
    pages = pdf.page_count
    pdf.close()
    return data, pages
