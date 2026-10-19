"""Turn the reviewed resume into a one-page PDF, in plain Python.

The page is drawn by code with PyMuPDF: every word is placed at a position we
work out here. No browser and no HTML engine run on the server, which keeps it
small and fast, and gives exact control over what ends up in the PDF:

- text is drawn letter by letter, never shaped, so "fi" and "fl" stay two
  letters in the text layer (no ligature characters to break ATS searches)
- the right-hand column of an entry header (dates, location) is measured
  first and never wraps; only the left text wraps, in the space left over
- links sit on the exact words they sat on in the original
- the text stays real text, in one column, so resume-parsing software can read it
"""

import logging
import re
from dataclasses import dataclass

import pymupdf
from pydantic import BaseModel, Field

from resume_agent.extract import Link
from resume_agent.models import LineKind, Mark, Styled
from resume_agent.parsing import normalize
from resume_agent.structure import carry_marks, mark_spans, parse_layout

log = logging.getLogger(__name__)

MAX_HEADER_LINES = 6  # name plus a few contact lines; more means we misread the top
# Font sizes to try, largest first. The first one that fits on one page wins.
FONT_SIZES = [10.5, 10.0, 9.5, 9.0, 8.5, 8.0]
MARGIN = 36  # points; 72 points make an inch, so this is half an inch
# The least space between an entry header's left text and its dates, in font
# sizes. Wider than extract.COLUMN_GAP, so the PDF reads back as two columns.
RIGHT_GAP = 3.0

_SHORT = Field(max_length=300)  # a heading, a title, a date range
_LINE = Field(max_length=1200)  # one bullet


# What the browser sends back to be rendered. It holds the visitor's own resume
# after their accept and reject choices. Every field is length-limited because
# this endpoint takes text from the internet. Fields added later have defaults,
# so a request in the old shape still renders.
class DocMark(BaseModel):
    text: str = Field(max_length=300)
    n: int = Field(default=0, ge=0, le=100)
    bold: bool = False
    italic: bool = False
    url: str | None = Field(default=None, max_length=2000)


class DocStyled(BaseModel):
    text: str = Field(default="", max_length=600)
    marks: list[DocMark] = Field(default=[], max_length=20)


class DocHeaderLine(BaseModel):
    left: DocStyled = DocStyled()
    right: DocStyled = DocStyled()


class DocLine(BaseModel):
    text: str = _LINE
    kind: LineKind = "bullet"
    join: bool = False  # continues the paragraph of the line before it
    marks: list[DocMark] = Field(default=[], max_length=40)  # marks of `original`
    # The line as written, when `text` is a rewrite of it: its marks are moved
    # onto the rewrite, and it is printed instead if the rewrite lost a link.
    original: str | None = Field(default=None, max_length=1200)


class DocEntry(BaseModel):
    title: str = _SHORT
    organization: str = _SHORT
    dates: str = _SHORT
    location: str = Field(default="", max_length=300)
    header_lines: list[DocHeaderLine] = Field(default=[], max_length=4)
    lines: list[str | DocLine] = Field(max_length=60)


class DocSection(BaseModel):
    name: str = _SHORT
    entries: list[DocEntry] = Field(max_length=40)


class ResumeDoc(BaseModel):
    header: list[str] = Field(max_length=MAX_HEADER_LINES)
    header_marks: list[list[DocMark]] = Field(default=[], max_length=MAX_HEADER_LINES)
    links: list[Link] = Field(max_length=40)
    sections: list[DocSection] = Field(max_length=20)


def clean_contact(line: str) -> str:
    """One contact line with its empty items removed.

    A header like "Pune |  | meera@example.com |" has gaps where the PDF held an
    icon or a link with no text. Printed as it is, the gaps show as "| |". This
    splits the line at each "|", keeps the pieces that hold a letter or a digit,
    and joins them again. A line with nothing left comes back empty.
    """
    # \w matches a letter or a digit, so a lone "•" or "-" counts as empty too.
    parts = [part.strip() for part in line.split("|")]
    return " | ".join(part for part in parts if re.search(r"\w", part))


def header_lines(text: str) -> list[Styled]:
    """The name and the contact lines, with their links, as the parser read them."""
    lines: list[Styled] = []
    for n, line in enumerate(parse_layout(text).header):
        # The name is kept as written. Contact lines lose their empty items;
        # marks name their words, so they still find them afterwards.
        shown = line.text if n == 0 else clean_contact(line.text)
        if shown:
            lines.append(Styled(text=shown[:300], marks=line.marks))
        if len(lines) == MAX_HEADER_LINES:
            break
    return lines


def split_header(text: str) -> list[str]:
    """The lines above the first section: the name and the contact details."""
    return [line.text for line in header_lines(text)]


def doc_from_result(result: dict, kept: frozenset[str] = frozenset()) -> ResumeDoc:
    """The resume to render from a run's result: every rewrite in, except the
    bullet IDs in `kept`, where the visitor chose their original line.
    web/lib/resume.ts does the same in the browser."""
    text = {b["id"]: b["text"] for b in result["bullets"]}
    return ResumeDoc(
        header=result["header"],
        header_marks=result.get("header_marks", []),
        links=result["links"],
        sections=[
            {
                "name": section["name"],
                "entries": [
                    {
                        **{k: entry.get(k, "") for k in ("title", "organization", "dates", "location")},
                        "header_lines": entry.get("header_lines", []),
                        "lines": [
                            {
                                "text": text.get(line["bullet_id"], line["original"])
                                if line["bullet_id"] and line["bullet_id"] not in kept
                                else line["original"],
                                # A run saved before kinds existed: bullets
                                # under a header, plain rows without one.
                                "kind": line.get("kind")
                                or ("bullet" if entry["title"] or entry["organization"] else "line"),
                                "join": line.get("join", False),
                                "marks": line.get("marks", []),
                                "original": line["original"],
                            }
                            for line in entry["lines"]
                        ],
                    }
                    for entry in section["entries"]
                ],
            }
            for section in result["sections"]
        ],
    )


# --- links ---------------------------------------------------------------------

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


# --- styled text to runs ----------------------------------------------------------

_Run = tuple[str, bool, bool, str | None]  # text, bold, italic, url


@dataclass
class _Text:
    """One line's text and marks, ready to be cut into runs."""

    text: str
    marks: list[Mark | DocMark]
    bold: bool = False  # the whole text is bold (the name, a heading)


class _Linker:
    """Decides which words are links.

    A resume read from a PDF carries its links as marks, each on its exact
    words, and only those are drawn. An older request, or pasted text, has no
    marks: then a link is put on the first whole-word match of its label, and
    URLs and emails written out in the text become links too.
    """

    def __init__(self, doc: ResumeDoc) -> None:
        marks = [m for marks in doc.header_marks for m in marks]
        for section in doc.sections:
            for entry in section.entries:
                for header in entry.header_lines:
                    marks += header.left.marks + header.right.marks
                marks += [m for line in entry.lines if isinstance(line, DocLine) for m in line.marks]
        self.positioned = any(m.url for m in marks)
        self.links = [l for l in doc.links if _safe(l.url)]
        self.drawn: set[str] = set()  # URLs placed somewhere on the page

    def runs(self, item: _Text) -> list[_Run]:
        text = item.text
        n = len(text)
        bold = [item.bold] * n
        italic = [False] * n
        url: list[str | None] = [None] * n
        for start, end, mark in mark_spans(text, list(item.marks)):
            for i in range(start, end):
                bold[i] = bold[i] or mark.bold
                italic[i] = italic[i] or mark.italic
                if mark.url and _safe(mark.url):
                    url[i] = mark.url
        if not self.positioned:
            self._legacy_links(text, url)
        runs: list[_Run] = []
        for i, c in enumerate(text):
            style = (bold[i], italic[i], url[i])
            if runs and runs[-1][1:] == style:
                runs[-1] = (runs[-1][0] + c, *style)
            else:
                runs.append((c, *style))
        self.drawn |= {u for u in url if u}
        return runs

    def _legacy_links(self, text: str, url: list[str | None]) -> None:
        for link in self.links:
            if link.url in self.drawn or len(link.label) < 2:
                continue
            found = mark_spans(text, [Mark(text=link.label)])
            if found and all(u is None for u in url[found[0][0] : found[0][1]]):
                start, end, _ = found[0]
                url[start:end] = [link.url] * (end - start)
                self.drawn.add(link.url)
        for match in _URL.finditer(text):  # URLs and emails written out in the text
            if all(u is None for u in url[match.start() : match.end()]):
                url[match.start() : match.end()] = [_href(match.group(0))] * (match.end() - match.start())

    def missing(self) -> list[Link]:
        """Links with no words on the page (an icon, say): listed in the header."""
        return [l for l in self.links if l.url not in self.drawn]


# --- fonts -----------------------------------------------------------------------


class _Fonts:
    """Helvetica in four styles, and a fallback for characters it lacks."""

    def __init__(self) -> None:
        self.styles = {
            (False, False): pymupdf.Font("helv"),
            (True, False): pymupdf.Font("hebo"),
            (False, True): pymupdf.Font("heit"),
            (True, True): pymupdf.Font("hebi"),
        }
        self.fallback = pymupdf.Font("cjk")  # wide coverage: symbols, CJK
        self.has: dict[str, bool] = {}

    def pick(self, c: str, bold: bool, italic: bool) -> pymupdf.Font:
        if c not in self.has:
            self.has[c] = bool(self.styles[(False, False)].has_glyph(ord(c)))
        if self.has[c] or not self.fallback.has_glyph(ord(c)):
            return self.styles[(bold, italic)]
        return self.fallback


# --- layout ----------------------------------------------------------------------


@dataclass
class _Piece:
    """A run of characters drawn in one font, with its link."""

    text: str
    font: pymupdf.Font
    url: str | None
    width: float


_Word = list[_Piece]  # a word, with the space before it in its first piece


class _Page:
    """Everything to draw, page by page, as positioned pieces and rules."""

    def __init__(self, size: float, fonts: _Fonts, paper: pymupdf.Rect) -> None:
        self.size = size
        self.fonts = fonts
        self.paper = paper
        self.left = MARGIN
        self.right = paper.width - MARGIN
        self.bottom = paper.height - MARGIN
        self.y = float(MARGIN)  # top of the next line
        self.pages: list[list[tuple]] = [[]]
        self.wrapped_headers = 0  # entry header lines whose left text needed two lines

    # -- measuring --

    def words(self, runs: list[_Run], size: float) -> list[_Word]:
        """Runs cut into words. Each space goes with the word after it."""
        words: list[_Word] = []
        word: _Word = []
        pending_space = False
        for text, bold, italic, url in runs:
            for c in text:
                if c == " ":
                    if word:
                        words.append(word)
                        word = []
                    pending_space = bool(words)
                    continue
                if pending_space and not word:
                    word.append(self._piece(" ", bold, italic, url, size))
                    pending_space = False
                font = self.fonts.pick(c, bold, italic)
                last = word[-1] if word else None
                # The space before a word stays a piece of its own, so it can be
                # left out when the word starts a line.
                if last and last.text != " " and last.font is font and last.url == url:
                    last.text += c
                    last.width += font.text_length(c, size)
                else:
                    word.append(_Piece(c, font, url, font.text_length(c, size)))
        if word:
            words.append(word)
        return words

    def _piece(self, text: str, bold: bool, italic: bool, url: str | None, size: float) -> _Piece:
        font = self.fonts.styles[(bold, italic)]
        return _Piece(text, font, url, font.text_length(text, size))

    @staticmethod
    def width(word: _Word, first: bool = False) -> float:
        """A word's width; the first word on a line drops its leading space."""
        pieces = word[1:] if first and word and word[0].text == " " else word
        return sum(p.width for p in pieces)

    def wrap(self, words: list[_Word], width: float) -> list[list[_Word]]:
        """Greedy line filling: as many words per line as fit in `width`."""
        lines: list[list[_Word]] = []
        line: list[_Word] = []
        used = 0.0
        for word in words:
            w = self.width(word, first=not line)
            if line and used + w > width:
                lines.append(line)
                line, used = [], 0.0
                w = self.width(word, first=True)
            line.append(word)
            used += w
        if line:
            lines.append(line)
        return lines

    # -- placing --

    def need(self, height: float) -> None:
        """Move to a new page if `height` does not fit on this one."""
        if self.y + height > self.bottom and self.y > MARGIN:
            self.pages.append([])
            self.y = float(MARGIN)

    def place(self, line: list[_Word], x: float, baseline: float, size: float) -> float:
        """Queue one line of words at x; returns where it ends."""
        first = True
        for word in line:
            for piece in word:
                if first and piece.text == " ":
                    continue  # no leading space at the start of a line
                self.pages[-1].append(("text", x, baseline, piece.text, piece.font, size, piece.url, piece.width))
                x += piece.width
                first = False
        return x

    def block(
        self,
        runs: list[_Run],
        x: float,
        size: float,
        width: float | None = None,
        centre: bool = False,
        right: list[_Run] | None = None,
        bullet: bool = False,
        after: float = 0.0,
    ) -> None:
        """A wrapped block of text, with an optional right-hand column on its
        first line and an optional bullet sign before it."""
        leading = 1.22 * size
        right_words = self.words(right or [], size)
        right_width = sum(self.width(w, first=i == 0) for i, w in enumerate(right_words))
        width = (width if width is not None else self.right - x)
        if right_words:
            # The right-hand text never wraps: the left text gets what is left,
            # less a clear gap, so a reader (or an ATS) sees two columns.
            width -= right_width + RIGHT_GAP * size
        lines = self.wrap(self.words(runs, size), max(width, 3 * size))
        if right_words and len(lines) > 1:
            self.wrapped_headers += 1
        for n, line in enumerate(lines or [[]]):
            self.need(leading)
            baseline = self.y + 0.8 * size
            start = x
            if centre:
                start = x + (width - sum(self.width(w, first=i == 0) for i, w in enumerate(line))) / 2
            if bullet and n == 0:
                font = self.fonts.styles[(False, False)]
                self.pages[-1].append(("text", x - 0.9 * size, baseline, "•", font, size, None, 0.0))
            self.place(line, start, baseline, size)
            if n == 0 and right_words:
                self.place(right_words, self.right - right_width, baseline, size)
            self.y += leading
        self.y += after

    def rule(self, gap: float) -> None:
        y = self.y - 0.1 * self.size
        self.pages[-1].append(("rule", self.left, self.right, y))
        self.y += gap


def _runs_of(linker: _Linker, styled: DocStyled | Styled, bold: bool = False) -> list[_Run]:
    return linker.runs(_Text(styled.text, list(styled.marks), bold))


def _header_lines(entry: DocEntry) -> list[DocHeaderLine]:
    """The entry header as written, or, for an older request, built from the
    fields: organisation and dates, then title and location."""
    if entry.header_lines:
        return entry.header_lines
    first, second = (entry.organization, entry.title) if entry.organization else (entry.title, "")
    lines = []
    if first or entry.dates:
        lines.append(DocHeaderLine(
            left=DocStyled(text=first, marks=[DocMark(text=first, bold=True)] if first else []),
            right=DocStyled(text=entry.dates),
        ))
    if second or entry.location:
        lines.append(DocHeaderLine(
            left=DocStyled(text=second, marks=[DocMark(text=second, italic=True)] if second else []),
            right=DocStyled(text=entry.location, marks=[DocMark(text=entry.location, italic=True)] if entry.location else []),
        ))
    return lines


def _doc_lines(entry: DocEntry) -> list[DocLine]:
    """The entry's lines as DocLines. An older request sends plain strings: they
    are bullets under a header, rows without one, and a line that only repeats
    the entry title is left out, as before."""
    lines: list[DocLine] = []
    headed = bool(entry.title or entry.organization)
    for line in entry.lines:
        if isinstance(line, DocLine):
            lines.append(line)
        elif normalize(line) != normalize(entry.title):
            lines.append(DocLine(text=line, kind="bullet" if headed else "line"))
    return lines


def _final(line: DocLine) -> _Text:
    """The text to print for a line, with its marks moved onto it.

    A rewrite that lost the words a link sat on is not printed: the original
    line is, so no link is lost.
    """
    if line.original is None or line.text == line.original:
        return _Text(line.text, list(line.marks))
    moved, lost = carry_marks(list(line.marks), line.text)
    if any(m.url for m in lost):
        log.warning("a rewrite lost a link's words; printing the original line")
        return _Text(line.original, list(line.marks))
    return _Text(line.text, moved)


def _layout(
    doc: ResumeDoc, size: float, fonts: _Fonts, paper: pymupdf.Rect, extra: list[Link]
) -> tuple[_Page, _Linker]:
    """Place the whole resume at one font size. `extra` are links with no words
    on the page; they are written out at the end of the contact line."""
    page = _Page(size, fonts, paper)
    linker = _Linker(doc)
    full = page.right - page.left
    name = doc.header[0] if doc.header else ""
    name_size = 2 * size
    # A long name shrinks until it fits on one line.
    while name and name_size > size and fonts.styles[(True, False)].text_length(name, name_size) > full:
        name_size -= 0.5
    if name:
        page.block(linker.runs(_Text(name, [], bold=True)), page.left, name_size, full, centre=True)

    marks = list(doc.header_marks) + [[]] * len(doc.header)  # padded: may be absent
    contact: list[_Run] = []
    for n, raw in enumerate(doc.header[1:], start=1):
        # Cleaned again here: this endpoint renders whatever the browser sends.
        line = clean_contact(raw)
        if line:
            if contact:
                contact.append((" | ", False, False, None))
            contact += linker.runs(_Text(line, list(marks[n])))
    for link in extra:
        shown = re.sub(r"^(https?://|mailto:)", "", link.url).rstrip("/")
        if contact:
            contact.append((" | ", False, False, None))
        contact.append((shown, False, False, link.url))
        linker.drawn.add(link.url)
    if contact:
        page.block(contact, page.left, size, full, centre=True, after=0.2 * size)
    for section in doc.sections:
        _section(page, linker, section, size)
    return page, linker


def _section(page: _Page, linker: _Linker, section: DocSection, size: float) -> None:
    heading_size = size + 1.5
    page.need(3 * heading_size)  # keep a heading with the line after it
    page.y += 0.45 * size
    if section.name:
        page.block(linker.runs(_Text(section.name, [], bold=True)), page.left, heading_size)
        page.rule(0.3 * size)
    for entry in section.entries:
        for header in _header_lines(entry):
            page.block(
                _runs_of(linker, header.left),
                page.left,
                size,
                right=_runs_of(linker, header.right),
            )
        lines = _doc_lines(entry)
        paragraph: list[_Run] = []
        for i, line in enumerate(lines):
            runs = linker.runs(_final(line))
            if line.kind == "sentence":
                if paragraph:
                    paragraph.append((" ", False, False, None))
                paragraph += runs
                nxt = lines[i + 1] if i + 1 < len(lines) else None
                if nxt is None or nxt.kind != "sentence" or not nxt.join:
                    page.block(paragraph, page.left, size, after=0.1 * size)
                    paragraph = []
            elif line.kind == "bullet":
                page.block(runs, page.left + 1.3 * size, size, bullet=True, after=0.05 * size)
            else:  # a row, or a line kept as written
                page.block(runs, page.left, size, after=0.05 * size)
        page.y += 0.25 * size


def _draw(page: _Page, paper: pymupdf.Rect) -> pymupdf.Document:
    pdf = pymupdf.open()
    for ops in page.pages:
        out = pdf.new_page(width=paper.width, height=paper.height)
        writer = pymupdf.TextWriter(out.rect)
        boxes: list[list] = []  # [x0, y0, x1, y1, url], merged per line
        for op in ops:
            if op[0] == "rule":
                _, x0, x1, y = op
                out.draw_line((x0, y), (x1, y), width=0.6)
                continue
            _, x, baseline, text, font, size, url, width = op
            writer.append((x, baseline), text, font=font, fontsize=size)
            if url:
                top, bottom = baseline - 0.8 * size, baseline + 0.25 * size
                last = boxes[-1] if boxes else None
                if last and last[4] == url and abs(last[1] - top) < 0.1 and x - last[2] < size:
                    last[2] = x + width  # the next piece of the same link on this line
                else:
                    boxes.append([x, top, x + width, bottom, url])
        writer.write_text(out)
        for x0, y0, x1, y1, url in boxes:
            out.insert_link({"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(x0, y0, x1, y1), "uri": url})
    return pdf


def render_pdf(doc: ResumeDoc) -> tuple[bytes, int]:
    """Return the PDF and its page count. Shrinks the font until it is one page."""
    paper = pymupdf.paper_rect("a4")
    fonts = _Fonts()
    # A first pass finds the links with no words on the page (an icon, say),
    # so the real passes can list them in the header and none is lost.
    _, linker = _layout(doc, FONT_SIZES[0], fonts, paper, [])
    missing = linker.missing()
    pages = [_layout(doc, size, fonts, paper, missing)[0] for size in FONT_SIZES]
    one_page = [page for page in pages if len(page.pages) == 1]
    # The largest size that fits one page with every entry header on one line,
    # as in the original; else the largest that fits one page; else the
    # smallest, and the caller reports the real page count instead of pretending.
    page = next(
        (p for p in one_page if not p.wrapped_headers),
        one_page[0] if one_page else pages[-1],
    )
    pdf = _draw(page, paper)
    pdf.subset_fonts()  # embed only the letters used, not whole fonts
    data = pdf.tobytes(garbage=3, deflate=True)  # drop unused objects, compress
    pages = pdf.page_count
    pdf.close()
    return data, pages
