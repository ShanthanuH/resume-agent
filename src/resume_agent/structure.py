"""Resume layout to header, sections, entries and lines, in plain code.

No model reads the structure. Every printed line is placed by the rules below,
using the layout from extract.py, so nothing can be reworded, merged or lost:

- the header is the name plus the contact lines under it
- a heading is found by its looks (bigger, bold, capitals, a rule under it),
  with a list of usual heading words as a fallback
- an entry header is a line with right-hand text (dates, a place), plus the
  lines that belong with it; it is kept exactly as written
- a bulleted line is a bullet; a line that wraps is joined to the line it
  continues; a summary paragraph is split into sentences
- anything else is kept in place, as written
"""

import logging
import re
from dataclasses import dataclass, field

import pymupdf
from pydantic import BaseModel

from resume_agent import extract
from resume_agent.extract import LayoutLine, ResumeText, Span, layout_from_text
from resume_agent.models import Entry, HeaderLine, LineKind, Mark, Styled

log = logging.getLogger(__name__)

# Usual section headings, lower case, "&" written as "and". Unknown headings
# still count when they look like headings; this list catches the rest.
HEADINGS = {
    "summary", "professional summary", "career summary", "profile",
    "professional profile", "objective", "career objective", "about", "about me",
    "experience", "work experience", "professional experience", "employment",
    "employment history", "work history", "internships", "internship",
    "education", "academic background", "projects", "personal projects",
    "academic projects", "selected projects", "skills", "technical skills",
    "core skills", "key skills", "skills and tools", "activities",
    "extracurricular activities", "extracurriculars", "leadership",
    "leadership experience", "leadership and activities", "publications",
    "certifications", "certificates", "licenses and certifications", "awards",
    "honors", "honours", "awards and honors", "awards and honours",
    "achievements", "volunteering", "volunteer experience", "languages",
    "interests", "hobbies", "references", "research", "research experience",
    "coursework", "relevant coursework", "positions of responsibility",
    "training", "patents", "talks", "presentations", "open source",
}

# What a section holds, from words in its heading. "other" for the rest.
SECTION_KINDS = [
    ("summary", ("summary", "profile", "objective", "about")),
    ("projects", ("project",)),
    ("education", ("education", "academic background")),
    ("skills", ("skill",)),
    ("experience", ("experience", "employment", "work history", "internship")),
]

BULLETS = "•●▪■◦‣∙·*–-"  # signs that start a bulleted line
# Words that make a header part a job title rather than an organisation.
_ROLE = re.compile(
    r"\b(engineer|developer|intern|manager|analyst|scientist|researcher|member|"
    r"lead|assistant|consultant|associate|officer|director|designer|architect|"
    r"specialist|fellow|founder|co-founder|head|president|secretary|volunteer|"
    r"coordinator|administrator|technician|programmer|trainee|apprentice|"
    r"instructor|tutor|teacher|professor|student|representative|captain|chair|"
    r"editor|writer|owner|executive|advisor|mentor)s?\b",
    re.IGNORECASE,
)
_DATE = re.compile(
    r"\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b"
    r"|\b(present|current|now|ongoing)\b",
    re.IGNORECASE,
)
# A whole line that is only a date or a date range: "Jan 2022 – Present", "2016 – 2019".
_WHEN = r"(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}|present|current|now|ongoing"
_DATE_ONLY = re.compile(rf"\s*(?:{_WHEN})(?:\s*(?:–|—|-|to)\s*(?:{_WHEN}))?\s*", re.IGNORECASE)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
_PHONE = re.compile(r"\+?\d[\d\s().-]{6,}\d")
# A URL, or a bare domain with a lower-case ending: "site.dev/x". "B.Tech" is not one.
_WEB = re.compile(r"(https?://|www\.)\S+|\b[\w-]+(\.[\w-]+)*\.[a-z]{2,10}(/\S*)?\b")
_SEPARATORS = re.compile(r"\s*[|•·◦♦⋄]\s*|\s{2,}")
# The live site swaps contact details for placeholders before parsing
# (api/redact.py), so a placeholder counts as a contact detail.
_PLACEHOLDER = re.compile(r"\[(EMAIL|PHONE|LINK)_\d+\]")
# A sentence ends at . ! or ? followed by a space and a capital or a digit.
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"“(])")
# Words that end in a full stop without ending a sentence.
_ABBREVIATIONS = {"e.g.", "i.e.", "etc.", "vs.", "dr.", "mr.", "ms.", "mrs.", "inc.", "ltd.", "jr.", "sr.", "st.", "no.", "approx."}


class Item(BaseModel):
    """One line under an entry, as the parser placed it."""

    kind: LineKind
    text: Styled
    join: bool = False  # continues the paragraph of the item before it


class ParsedEntry(BaseModel):
    entry: Entry
    items: list[Item] = []


class ParsedSection(BaseModel):
    heading: str  # as written
    kind: str
    entries: list[ParsedEntry] = []


class ParsedResume(BaseModel):
    header: list[Styled]  # the name, then each contact line
    sections: list[ParsedSection]
    # One per line kept as written because it fit no pattern. Their text is
    # not included: resume text must not reach the logs.
    warnings: list[str] = []


def section_kind(heading: str) -> str:
    low = heading.lower()
    for kind, words in SECTION_KINDS:
        if any(word in low for word in words):
            return kind
    return "other"


# --- styled text --------------------------------------------------------------

_Run = tuple[int, int, bool, bool, str | None]  # start, end, bold, italic, url


def _join(spans: list[Span]) -> tuple[str, list[_Run]]:
    """Spans as one string with single spaces, and where each style run sits."""
    text = ""
    runs: list[_Run] = []
    for span in spans:
        piece = re.sub(r"\s+", " ", span.text)
        if not text or text.endswith(" "):
            piece = piece.lstrip()
        start = len(text)
        text += piece
        if span.bold or span.italic or span.url:
            runs.append((start, len(text), span.bold, span.italic, span.url))
    stripped = text.rstrip()
    return stripped, [(s, min(e, len(stripped)), b, i, u) for s, e, b, i, u in runs]


def mark_pattern(anchor: str) -> re.Pattern[str]:
    """Finds `anchor` as whole words: "live" is found in "(live," but not in
    "delivered". Shared by the parser and the renderer, so a mark counted here
    is found again there."""
    start = r"(?<!\w)" if anchor[:1].isalnum() else ""
    end = r"(?!\w)" if anchor[-1:].isalnum() else ""
    return re.compile(start + re.escape(anchor) + end)


def _styled(text: str, runs: list[_Run]) -> Styled:
    """Text plus Marks, each mark naming its words and which occurrence it is."""
    spans: list[list] = []  # [start, end, bold, italic, url], merged below
    for start, end, bold, italic, url in runs:
        # Grow to whole words, so the words can be found again by mark_pattern.
        while start > 0 and start < len(text) and text[start - 1].isalnum() and text[start].isalnum():
            start -= 1
        while 0 < end < len(text) and text[end - 1].isalnum() and text[end].isalnum():
            end += 1
        # Trim spaces and separators at the edges: they carry no style.
        while start < end and text[start] in " |•·":
            start += 1
        while end > start and text[end - 1] in " |•·":
            end -= 1
        if start >= end:
            continue
        last = spans[-1] if spans else None
        if last and last[2:] == [bold, italic, url] and not text[last[1]:start].strip():
            last[1] = end  # touches the run before and looks the same: one mark
        else:
            spans.append([start, end, bold, italic, url])
    marks: list[Mark] = []
    for start, end, bold, italic, url in spans:
        anchor = text[start:end]
        # Which occurrence of these words this is, counted the way it is found.
        starts = [m.start() for m in mark_pattern(anchor).finditer(text)]
        if start not in starts:  # cannot be found again: keep no mark for it
            continue
        marks.append(Mark(text=anchor, n=starts.index(start), bold=bold, italic=italic, url=url))
    return Styled(text=text, marks=marks)


def styled(spans: list[Span]) -> Styled:
    return _styled(*_join(spans))


def carry_marks(marks: list[Mark], text: str) -> tuple[list[Mark], list[Mark]]:
    """The marks of a line, moved onto a new text for that line.

    Each mark goes to the same occurrence of its words in `text`, or to the last
    one there if the new text has fewer. Returns (moved, lost): lost marks have
    no words to sit on any more.
    """
    moved: list[Mark] = []
    lost: list[Mark] = []
    for mark in marks:
        count = len(mark_pattern(mark.text).findall(text))
        if count:
            moved.append(mark.model_copy(update={"n": min(mark.n, count - 1)}))
        else:
            lost.append(mark)
    return moved, lost


def mark_spans(text: str, marks: list[Mark]) -> list[tuple[int, int, Mark]]:
    """Where each mark sits in `text`, as (start, end, mark). Marks whose words
    are not there are left out."""
    found: list[tuple[int, int, Mark]] = []
    for mark in marks:
        matches = list(mark_pattern(mark.text).finditer(text))
        if len(matches) > mark.n:
            found.append((matches[mark.n].start(), matches[mark.n].end(), mark))
    return found


# --- line tests -----------------------------------------------------------------


def _bullet(line: LayoutLine) -> bool:
    text = "".join(s.text for s in line.left).lstrip()
    if not text:
        return False
    # "-" and "*" and "–" only count with a space after, so "-5%" is not a bullet.
    return text[0] in "•●▪■◦‣∙·" or (text[0] in BULLETS and text[1:2] == " ")


def _without_bullet(spans: list[Span]) -> list[Span]:
    spans = [s.model_copy() for s in spans]
    while spans and not spans[0].text.strip():
        spans.pop(0)
    if spans:
        spans[0].text = spans[0].text.lstrip()[1:].lstrip()
        if not spans[0].text:
            spans.pop(0)
    return spans


def _starts_bold(line: LayoutLine) -> bool:
    first = next((s for s in line.left if s.text.strip()), None)
    return bool(first and first.bold)


def _all_bold(line: LayoutLine) -> bool:
    spans = [s for s in line.left if any(c.isalnum() for c in s.text)]
    return bool(spans) and all(s.bold for s in spans)


def _all_styled(line: LayoutLine) -> bool:
    """Every letter in the line is bold or italic, as in an entry title line."""
    spans = [s for s in line.left if any(c.isalnum() for c in s.text)]
    return bool(spans) and all(s.bold or s.italic for s in spans)


def _normal_heading(text: str) -> str:
    return " ".join(text.lower().replace("&", "and").rstrip(":").split())


def is_heading(line: LayoutLine, body_size: float, from_pdf: bool) -> bool:
    text = line.text.strip()
    words = text.split()
    if line.right or not text or len(words) > 5 or len(text) > 50 or _bullet(line):
        return False
    if text[-1] in ".,;":
        return False
    known = _normal_heading(text) in HEADINGS
    letters = [c for c in text if c.isalpha()]
    caps = len(letters) >= 4 and all(c.isupper() for c in letters)
    digits = any(c.isdigit() for c in text)
    if not from_pdf:  # pasted text: no fonts, so capitals and the word list
        return known or (caps and not digits and len(words) <= 4)
    bold = all(s.bold for s in line.left if any(c.isalpha() for c in s.text))
    bigger = line.size > body_size + 0.5
    # Google Docs headings are often only bigger: regular weight, Title Case.
    much_bigger = line.size >= body_size + 2.0
    return (
        known
        or line.rule_below
        or much_bigger
        or (bigger and (bold or caps))
        or (bold and caps and not digits)
    )


def is_date_only(text: str) -> bool:
    """The whole text is a date or a date range, as on a line of its own."""
    return bool(_DATE_ONLY.fullmatch(text))


def is_contact(text: str) -> bool:
    """A header line of contact details: an email, a phone or a web address,
    with nothing long beside them."""
    items = [p for p in _SEPARATORS.split(text) if p.strip()]
    if not items or any(len(p.split()) > 6 for p in items):
        return False
    return any(
        _EMAIL.search(p)
        or _WEB.search(p)
        or _PLACEHOLDER.search(p)
        or sum(c.isdigit() for c in p) >= 7 and _PHONE.search(p)
        for p in items
    )


_LABEL = re.compile(r"[^\W\d][^:]{0,28}:\s")  # "ML: ", "AI & LLMs: ", "Tools: "


def _label_row(text: str) -> bool:
    """A labelled list row: a short label and a colon, then the items."""
    match = _LABEL.match(text.lstrip())
    return bool(match) and len(match.group().split()) <= 4


def _list_break(prev: str, line: str) -> bool:
    """`prev` and `line` are two lines of a list, not one line that wrapped:
    contact details one per line, or a comma list whose line ends without a
    comma ("Go, Python, SQL" above "Docker, Kubernetes"). A list that wraps
    breaks after a comma."""
    if is_contact(prev) and is_contact(line):
        return True
    parts = prev.split(",")
    return (
        len(parts) >= 2
        and all(len(p.split()) <= 3 for p in parts)
        and not prev.rstrip().endswith((",", "&", " and"))
    )


def _looks_like_list(text: str) -> bool:
    """A comma-separated list of short items, like a tech stack."""
    parts = [p.strip() for p in text.split(",")]
    return len(parts) >= 3 and all(1 <= len(p.split()) <= 3 for p in parts)


def _sentences(text: str) -> list[tuple[int, int]]:
    """Where each sentence of a paragraph starts and ends."""
    cuts = [0]
    for match in _SENTENCE_END.finditer(text):
        word = text[: match.start()].split()[-1].lower()
        if word in _ABBREVIATIONS or re.fullmatch(r"\w\.", word):  # "e.g." or "J."
            continue
        cuts.append(match.end())
    ranges = []
    for i, start in enumerate(cuts):
        end = cuts[i + 1] if i + 1 < len(cuts) else len(text)
        ranges.append((start, len(text[:end].rstrip())))
    return ranges


# --- entry fields -----------------------------------------------------------


def entry_fields(lines: list[HeaderLine], kind: str) -> Entry:
    """Organisation, title, dates and location, read from the header as written."""
    # A line that is only a date (under "Company — Role", say) gives the dates.
    date_lines = [h.left.text for h in lines if not h.right.text and is_date_only(h.left.text)]
    lefts = [h.left.text for h in lines if h.left.text and h.left.text not in date_lines]
    rights = [h.right.text for h in lines if h.right.text]
    dates = next((r for r in rights if _DATE.search(r)), rights[0] if rights else "")
    dates = dates or (date_lines[0] if date_lines else "")
    location = next((r for r in rights if r != dates), "")
    title = organization = ""
    if kind == "projects" or len(lefts) == 1:
        single = lefts[0] if lefts else ""
        title = single  # a project's name and its stack, as written
        if kind != "projects":
            # "Company, Place — Role": a dash parts organisation and role before
            # a comma does, so the dashes are tried first.
            for separator in (" — ", " – ", " - ", " | ", " at ", ", "):
                parts = single.split(separator, 1)
                if len(parts) == 2 and (_ROLE.search(parts[0]) or _ROLE.search(parts[1])):
                    first_is_role = bool(_ROLE.search(parts[0]))
                    title, organization = parts if first_is_role else parts[::-1]
                    break
    elif lefts:
        first, second = lefts[0], lefts[1]
        if _ROLE.search(first) and not _ROLE.search(second):
            title, organization = first, second
        else:
            organization, title = first, second
    # An organisation is never a list of skills: that is a stack, and it stays
    # in the header lines as written.
    if _looks_like_list(organization):
        organization = ""
    return Entry(
        title=title,
        organization=organization,
        dates=dates,
        location=location,
        header_lines=lines,
    )


# --- the parser -------------------------------------------------------------


@dataclass
class _Draft:
    """An item being built: its spans grow while wrapped lines are joined."""

    kind: str  # "bullet", "line", "para" or "fixed"
    spans: list[Span]
    x0: float  # where its text starts, for telling a wrapped line from a new one
    last: LayoutLine  # the printed line it ends on


@dataclass
class _HeadDraft:
    """An entry header line being built: its left text can wrap onto the next line."""

    left: list[Span]
    right: list[Span]
    bold: bool  # starts in bold, as the first line of an entry often does
    last: LayoutLine  # the printed line its left text ends on


@dataclass
class _EntryDraft:
    header: list[_HeadDraft] = field(default_factory=list)
    items: list[_Draft] = field(default_factory=list)


_MEASURE = pymupdf.Font("helv")  # estimates how wide a word is in any font


def _joined(spans: list[Span], line: LayoutLine) -> list[Span]:
    """`spans` with the left text of the next printed line added after a space."""
    return spans + [Span(text=" ", x0=0, x1=0, size=0)] + line.left


def _body_size(lines: list[LayoutLine]) -> float:
    sizes: dict[float, int] = {}
    for line in lines:
        for span in line.left + line.right:
            key = round(span.size, 1)
            sizes[key] = sizes.get(key, 0) + len(span.text.strip())
    return max(sizes, key=sizes.get) if sizes else 0.0


def _text_x0(spans: list[Span]) -> float:
    first = next((s for s in spans if s.text.strip()), None)
    return first.x0 if first else 0.0


class _Parser:
    def __init__(self, text: ResumeText) -> None:
        self.lines = text.layout
        self.from_pdf = text.from_pdf
        self.body = _body_size(self.lines)
        # Per column (a page can have two, see extract.LayoutLine.column): the
        # right edge, where its furthest line ends, and the margin, where its
        # leftmost line starts.
        self.edges = extract.column_edges(self.lines)
        self.margins: dict[int, float] = {}
        for line in self.lines:
            if line.left:
                x0 = _text_x0(line.left)
                self.margins[line.column] = min(self.margins.get(line.column, x0), x0)
        self.sections: list[tuple[str, list[_EntryDraft]]] = []
        self.warnings: list[str] = []

    # -- helpers --

    def heading(self, i: int) -> bool:
        return is_heading(self.lines[i], self.body, self.from_pdf)

    def entries(self) -> list[_EntryDraft]:
        if not self.sections:  # text before any heading: a section with no heading
            self.sections.append(("", []))
        return self.sections[-1][1]

    def entry(self) -> _EntryDraft:
        entries = self.entries()
        if not entries:
            entries.append(_EntryDraft())
        return entries[-1]

    def right_only(self, line: LayoutLine) -> bool:
        """A line that is only right-aligned text, like a date on its own line."""
        if not self.from_pdf or line.right:
            return False
        size = line.size or self.body
        edge, margin = self.edges[line.column], self.margins.get(line.column, 0.0)
        return _text_x0(line.left) > margin + 0.6 * (edge - margin) and line.left[-1].x1 >= edge - 2 * size

    def wraps_onto(
        self, prev: LayoutLine, line: LayoutLine, x0: float, limit: float, hanging: bool = False
    ) -> bool:
        """True if `line` is text that wrapped from `prev`: it starts at `x0`,
        sits right under it, and the first word of `line` would not have fitted
        on `prev` before `limit`, the right end of the space it had.

        `hanging`: `x0` is indented past the margin, as a bullet's text is.
        Nothing else starts there, so `prev` only has to be mostly full. Line
        breaking does not always fill a line: "120 ms" with a non-breaking space
        moves down as one word."""
        size = line.size or self.body
        if line.page == prev.page and line.top - prev.bottom > 0.6 * size:
            return False  # a gap between them: a new block
        if abs(_text_x0(line.left) - x0) > 1.5:
            return False  # starts somewhere else: not the same column of text
        if hanging:
            return prev.left[-1].x1 >= x0 + 0.75 * (limit - x0)
        words = line.text.split()
        first = _MEASURE.text_length(words[0], size) if words else 0.0
        # A space is about 0.3 of the font size; one point covers rounding.
        return prev.left[-1].x1 + 0.3 * size + first >= limit - 1.0

    def continues(self, draft: _Draft, line: LayoutLine) -> bool:
        """True if `line` is the wrapped rest of the item `draft`."""
        if line.right or _bullet(line) or draft.kind == "fixed":
            return False
        if not self.from_pdf:
            # Pasted text: a wrapped line starts in lower case, or is indented
            # under a bullet.
            first = line.text.lstrip()[:1]
            return first.islower() or (draft.kind == "bullet" and _text_x0(line.left) > draft.x0)
        if draft.kind == "line" and _list_break(draft.last.text, line.text):
            return False
        if draft.kind == "line" and _label_row(_join(draft.spans)[0]) and _label_row(line.text):
            return False  # "ML: PyTorch" under "AI & LLMs: RAG, ...": the next row
        hanging = draft.kind == "bullet" and draft.x0 > self.margins.get(line.column, 0.0) + 1.5
        return self.wraps_onto(draft.last, line, draft.x0, self.edges[line.column], hanging)

    def continues_header(self, head: _HeadDraft, line: LayoutLine) -> bool:
        """True if `line` is the wrapped rest of a header line's left text. Its
        right-hand text took the end of the line, so the left text wrapped
        before reaching it."""
        if line.right or _bullet(line) or not self.from_pdf or not head.right:
            return False
        size = line.size or self.body
        limit = head.right[0].x0 - extract.COLUMN_GAP * size  # where the left text had to stop
        return self.wraps_onto(head.last, line, _text_x0(head.left), limit)

    def new_header_line(self, line: LayoutLine) -> None:
        """Add `line` to the current entry's header, or start a new entry."""
        entry = self.entries()[-1] if self.entries() else None
        bold = _starts_bold(line)
        if (
            entry is None
            or entry.items
            or len(entry.header) >= 3
            or (self.from_pdf and bold and any(h.bold for h in entry.header))
            or (not self.from_pdf and len(entry.header) >= 2)
        ):
            entry = _EntryDraft()
            self.entries().append(entry)
        entry.header.append(_HeadDraft(list(line.left), list(line.right), bold, line))

    # -- the walk --

    def run(self) -> ParsedResume:
        lines = self.lines
        header = [styled(lines[0].left + lines[0].right)] if lines else []
        i = 1
        while i < len(lines):
            text = lines[i].text
            # A short line right above a contact line (a city, or a subtitle in a
            # bigger font such as "Data Scientist") belongs to the header too.
            nxt = lines[i + 1].text if i + 1 < len(lines) else ""
            short_before = (
                len(text.split()) <= 4
                and is_contact(nxt)
                and not self.heading(i + 1)
                and _normal_heading(text) not in HEADINGS
            )
            # A subtitle right under the name, when the sections start at once
            # (in a sidebar layout the contact details are a section of their own).
            subtitle = (
                i == 1
                and len(text.split()) <= 4
                and i + 1 < len(lines)
                and self.heading(i + 1)
                and _normal_heading(text) not in HEADINGS
            )
            if not (short_before or subtitle or (is_contact(text) and not self.heading(i))):
                break
            header.append(styled(lines[i].left + lines[i].right))
            i += 1

        for i in range(i, len(lines)):
            line = lines[i]
            if self.heading(i):
                self.sections.append((line.text.strip(), []))
                continue
            kind = section_kind(self.sections[-1][0]) if self.sections else "other"
            nxt = lines[i + 1] if i + 1 < len(lines) and not self.heading(i + 1) else None
            entries = self.entries()
            current = entries[-1] if entries else None
            last = current.items[-1] if current and current.items else None
            head = current.header[-1] if current and current.header and not current.items else None

            if _bullet(line):
                spans = _without_bullet(line.left)
                self.entry().items.append(_Draft("bullet", spans, _text_x0(spans), line))
            elif last and self.continues(last, line):
                last.spans = _joined(last.spans, line)
                last.last = line
            elif head and self.continues_header(head, line):
                head.left = _joined(head.left, line)
                head.last = line
            elif line.right:
                self.new_header_line(line)
            elif self.right_only(line):
                if head and not head.right:
                    head.right = list(line.left)  # a date that sat on its own line
                else:
                    self.keep_as_written(line, i)
            elif current and current.header and not current.items and is_date_only(line.text):
                self.new_header_line(line)  # dates on a line of their own, under the header
            elif (
                self.from_pdf
                and kind in ("experience", "education", "projects")
                and _all_bold(line)
                and nxt is not None
                and not _bullet(nxt)
            ):
                self.new_header_line(line)  # a bold name starts an entry: "Goa University"
            elif (
                nxt is not None
                and (nxt.right or _bullet(nxt) or is_date_only(nxt.text))
                and not (current and current.items and kind == "summary")
            ):
                # A line right above an entry header, a bullet or a date line starts
                # an entry (a school above its degree line, a project name above its
                # bullets, "Company — Role" above its dates).
                self.new_header_line(line)
            elif (
                self.from_pdf
                and current
                and current.header
                and not current.items
                and _all_styled(line)
            ):
                self.new_header_line(line)  # an italic title line under the header
            else:
                draft_kind = "para" if kind == "summary" else "line"
                self.entry().items.append(_Draft(draft_kind, list(line.left), _text_x0(line.left), line))
        return ParsedResume(
            header=header,
            sections=[self.finish(heading, entries) for heading, entries in self.sections],
            warnings=self.warnings,
        )

    def keep_as_written(self, line: LayoutLine, index: int) -> None:
        reason = f"line {index + 1} fit no pattern and is kept as written"
        log.warning(reason)
        self.warnings.append(reason)
        self.entry().items.append(_Draft("fixed", list(line.left), _text_x0(line.left), line))

    def finish(self, heading: str, drafts: list[_EntryDraft]) -> ParsedSection:
        kind = section_kind(heading)
        entries: list[ParsedEntry] = []
        for draft in drafts:
            items: list[Item] = []
            for item in draft.items:
                text, runs = _join(item.spans)
                if not text:
                    continue
                if item.kind != "para":
                    items.append(Item(kind=item.kind, text=_styled(text, runs)))
                    continue
                for n, (start, end) in enumerate(_sentences(text)):
                    inside = [
                        (s - start, min(e, end) - start, b, it, u)
                        for s, e, b, it, u in runs
                        if s >= start and s < end
                    ]
                    items.append(Item(kind="sentence", text=_styled(text[start:end], inside), join=n > 0))
            header = [HeaderLine(left=styled(h.left), right=styled(h.right)) for h in draft.header]
            entries.append(ParsedEntry(entry=entry_fields(header, kind), items=items))
        return ParsedSection(heading=heading, kind=kind, entries=entries)


def as_resume_text(text: str) -> ResumeText:
    """The layout of `text`: its own when read from a PDF, else made from lines."""
    return text if isinstance(text, ResumeText) else layout_from_text(text)


def parse_layout(text: str) -> ParsedResume:
    """The resume's header and sections, every printed line accounted for."""
    return _Parser(as_resume_text(text)).run()
