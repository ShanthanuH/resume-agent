"""Resume PDF to text, hyperlinks and layout, using PyMuPDF.

The layout is what the parser in structure.py reads: every printed line, split
into a left part and a right-hand column (dates, places), with each run of text
in its own style (size, bold, italic) and the link it sits under, if any.
"""

import re
from collections import Counter
from pathlib import Path

import pymupdf
from pydantic import BaseModel, ConfigDict

# Ligature characters and the letters they stand for. A PDF can store "fi" as
# one character (U+FB01), and then a plain search for "verification" fails.
LIGATURES = {
    "ﬀ": "ff",
    "ﬁ": "fi",
    "ﬂ": "fl",
    "ﬃ": "ffi",
    "ﬄ": "ffl",
    "ﬅ": "st",
    "ﬆ": "st",
}

# Font names that mean bold or italic. Font flags say so too, but not always.
_BOLD_FONT = re.compile(r"bold|black|heavy|semibold|demi|cmbx", re.IGNORECASE)
_ITALIC_FONT = re.compile(r"italic|oblique|cmti|cmsl", re.IGNORECASE)
# Symbol fonts draw bullets and separators. Their flags often say "italic",
# so their characters take the style of the text around them instead.
_SYMBOL_FONT = re.compile(r"cmsy|symbol|dingbat|wingding|msam|msbm", re.IGNORECASE)

# A gap wider than this many font sizes splits a line into a left part and a
# right-hand column. Justified text stretches spaces to about half a size.
COLUMN_GAP = 2.5
# A narrower gap, from this many font sizes, also does when it is the only wide
# gap on the line and short text after it ends at the right edge: a long name
# pushes its dates close (12 pt before "Jun 2024 – Sep 2025" in one resume).
WIDE_GAP = 1.0
# Right-hand text must end this close to the right edge, in font sizes.
RIGHT_SLACK = 2.0
BULLET_SIGNS = set("•●▪■◦‣∙·*–-")  # signs that can start a bulleted line
# Word draws list bullets with Symbol or Wingdings characters, which a PDF text
# layer keeps as private-use code points (U+F0B7 for the usual round bullet).
# They are read as "•", or they print as "�" and the line is not seen as a bullet.
SYMBOL_BULLETS = dict.fromkeys("", "•")


class Link(BaseModel):
    label: str  # the visible text the link sits on, e.g. "GitHub"
    url: str


class Span(BaseModel):
    """A run of characters on one printed line, all in one style."""

    text: str
    x0: float
    x1: float
    size: float
    bold: bool = False
    italic: bool = False
    url: str | None = None


class LayoutLine(BaseModel):
    """One printed line: its left part, its right-hand column, and where it is."""

    left: list[Span]
    right: list[Span] = []
    top: float
    bottom: float
    page: int = 0
    rule_below: bool = False  # a horizontal rule under it, as under a heading
    # 0: the full width of the page. 1 and 2: the left and right column of a
    # two-column page (a sidebar layout). Each column has its own right edge.
    column: int = 0

    @property
    def text(self) -> str:
        """The whole line as plain text: left part, then the right-hand column."""
        left = "".join(s.text for s in self.left).strip()
        right = "".join(s.text for s in self.right).strip()
        return f"{left} {right}" if left and right else left or right

    @property
    def size(self) -> float:
        """The font size most of the line is printed in."""
        sizes = Counter()
        for span in self.left + self.right:
            sizes[round(span.size, 1)] += len(span.text.strip())
        return sizes.most_common(1)[0][0] if sizes else 0.0


class ResumeText(str):
    """The resume's text, carrying the layout it was read from.

    It is a str, so everything that takes plain resume text (the agent's
    start_session, the length checks, redaction) works with it unchanged.
    parse_resume reads `layout` when it is there. Pasted text has no layout,
    so a ResumeText is also made from plain text, one line per text line.
    """

    layout: list[LayoutLine]
    from_pdf: bool  # True: real positions and fonts; False: made from plain text

    def __new__(cls, layout: list[LayoutLine], from_pdf: bool = True) -> "ResumeText":
        self = super().__new__(cls, "\n".join(line.text for line in layout))
        self.layout = layout
        self.from_pdf = from_pdf
        return self


class ExtractedResume(BaseModel):
    # ResumeText is not a type pydantic knows, so it is checked with isinstance.
    model_config = ConfigDict(arbitrary_types_allowed=True)

    text: ResumeText
    links: list[Link]


def expand_ligatures(text: str) -> str:
    return "".join(LIGATURES.get(c, c) for c in text)


# One character as read from the page: (char, x0, x1, top, bottom, baseline,
# size, bold, italic, url).
_Char = tuple[str, float, float, float, float, float, float, bool, bool, str | None]


def _chars(page: pymupdf.Page) -> list[list[_Char]]:
    """Every character, grouped by the PDF's own text lines."""
    links = [
        (pymupdf.Rect(link["from"]), link["uri"])
        for link in page.get_links()
        if link["kind"] == pymupdf.LINK_URI  # skip internal page jumps
    ]
    # Without TEXT_PRESERVE_LIGATURES, PyMuPDF splits a ligature into its letters.
    flags = pymupdf.TEXT_PRESERVE_WHITESPACE | pymupdf.TEXT_MEDIABOX_CLIP
    pieces: list[list[_Char]] = []
    for block in page.get_text("rawdict", flags=flags)["blocks"]:
        if block["type"] != 0:  # an image block
            continue
        for line in block["lines"]:
            if abs(line["dir"][1]) > 0.01:  # rotated text: not part of the resume body
                continue
            chars: list[_Char] = []
            for span in line["spans"]:
                font = span["font"].split("+")[-1]  # drop the subset prefix "ABCDEF+"
                symbol = bool(_SYMBOL_FONT.search(font))
                bold = bool(span["flags"] & pymupdf.TEXT_FONT_BOLD or _BOLD_FONT.search(font))
                italic = bool(span["flags"] & pymupdf.TEXT_FONT_ITALIC or _ITALIC_FONT.search(font))
                for ch in span["chars"]:
                    x0, y0, x1, y1 = ch["bbox"]
                    centre = pymupdf.Point((x0 + x1) / 2, (y0 + y1) / 2)
                    url = next((uri for rect, uri in links if rect.contains(centre)), None)
                    if symbol and chars:  # take the style of the character before
                        bold, italic = chars[-1][7], chars[-1][8]
                    letters = LIGATURES.get(ch["c"]) or SYMBOL_BULLETS.get(ch["c"], ch["c"])
                    step = (x1 - x0) / len(letters)  # share the box between the letters
                    for i, c in enumerate(letters):
                        chars.append(
                            (c, x0 + i * step, x0 + (i + 1) * step, y0, y1,
                             ch["origin"][1], span["size"], bold, italic, url)
                        )
            if any(c[0].strip() for c in chars):
                pieces.append(chars)
    return pieces


def _spans(chars: list[_Char]) -> list[Span]:
    """Characters of one printed line (sorted left to right) as styled runs."""
    spans: list[Span] = []
    for c, x0, x1, _, _, _, size, bold, italic, url in chars:
        if c.isspace():
            c = " "
        last = spans[-1] if spans else None
        gap = x0 - last.x1 if last else 0.0  # from the last visible character
        # A visible gap with no space character in it still separates words.
        if last and gap > 0.15 * size and not last.text.endswith(" ") and c != " ":
            last.text += " "
        # A bullet sign at the start of a line gets a run of its own, so the
        # text after it has its own start position (wrapped lines align to it).
        after_bullet = len(spans) == 1 and spans[0].text.strip() in BULLET_SIGNS and spans[0].text.endswith(" ")
        same_style = last and (last.bold, last.italic, last.url) == (bold, italic, url)
        if c == " " and last:  # a space joins the run before; x1 stays at the last letter
            last.text += c
        elif last and same_style and abs(last.size - size) < 0.5 and gap < WIDE_GAP * size and not after_bullet:
            last.text += c
            last.x1 = max(last.x1, x1)
        else:  # a new style, or text after a wide gap (maybe a right-hand column)
            spans.append(Span(text=c, x0=x0, x1=x1, size=size, bold=bold, italic=italic, url=url))
    return spans


def _rules(page: pymupdf.Page) -> list[tuple[float, float, float]]:
    """Long horizontal rules drawn on the page, as (height, x0, x1)."""
    width = page.rect.width
    rules: list[tuple[float, float, float]] = []
    for drawing in page.get_drawings():
        for item in drawing["items"]:
            if item[0] == "l":  # a line from item[1] to item[2]
                p1, p2 = item[1], item[2]
                if abs(p1.y - p2.y) < 1 and abs(p2.x - p1.x) > 0.3 * width:
                    rules.append(((p1.y + p2.y) / 2, min(p1.x, p2.x), max(p1.x, p2.x)))
            elif item[0] == "re":  # a rectangle: a rule when it is flat and wide
                rect = item[1]
                if rect.height < 2 and rect.width > 0.3 * width:
                    rules.append(((rect.y0 + rect.y1) / 2, rect.x0, rect.x1))
    return rules


GUTTER = 8.0  # the least empty width, in points, between two columns of text


def _gutter(pieces: list[list[_Char]], page: pymupdf.Rect) -> tuple[float, float, float] | None:
    """Where a two-column page splits, as (x, top, bottom): the gutter's middle,
    and the stretch of baselines where both columns run side by side. None for
    a page in one column.

    Two columns: some x between 15% and 70% of the width that text ends before
    or starts well after, with nothing crossing it in that stretch. On a page in
    one column, bullets and paragraphs cross every such x between the dates.
    """
    boxes = []
    for chars in pieces:
        visible = [c for c in chars if c[0].strip()]
        boxes.append((min(c[1] for c in visible), max(c[2] for c in visible), chars[0][5]))
    for x in sorted({x1 for _, x1, _ in boxes}):
        if not 0.15 * page.width < x < 0.7 * page.width:
            continue
        left = [b for b in boxes if b[1] <= x]
        right = [b for b in boxes if b[0] >= x + GUTTER]
        if len(left) < 4 or len(right) < 4:
            continue
        top = max(min(b[2] for b in left), min(b[2] for b in right))
        bottom = min(max(b[2] for b in left), max(b[2] for b in right))
        if bottom - top < 0.2 * page.height:
            continue  # side by side only briefly: a small table, not a layout
        across = [b for b in boxes if b[1] > x and b[0] < x + GUTTER]
        if not any(top <= b[2] <= bottom for b in across):
            return x + GUTTER / 2, top, bottom
    return None


def _group(pieces: list[list[_Char]]) -> list[list[_Char]]:
    """Pieces whose baselines nearly match, joined into printed lines."""
    groups: list[list[_Char]] = []
    for chars in sorted(pieces, key=lambda chars: chars[0][5]):  # by baseline
        baseline, size = chars[0][5], max(c[6] for c in chars)
        # The left text and a right-aligned date are often separate pieces in a
        # PDF, and a bullet sign sits a little higher than its text.
        if groups and abs(groups[-1][0][5] - baseline) <= 0.35 * max(size, groups[-1][0][6]):
            groups[-1].extend(chars)
        else:
            groups.append(list(chars))
    return groups


def _page_lines(page: pymupdf.Page, number: int) -> list[LayoutLine]:
    pieces = _chars(page)
    split = _gutter(pieces, page.rect)
    if split is None:
        regions = [(0, pieces)]
    else:
        # Reading order: full-width text above (the name), the left column, the
        # right column, then full-width text below.
        x, top, bottom = split
        left = [p for p in pieces if max(c[2] for c in p if c[0].strip()) <= x]
        right = [p for p in pieces if min(c[1] for c in p if c[0].strip()) >= x]
        wide = [p for p in pieces if p not in left and p not in right]
        regions = [
            (0, [p for p in wide if p[0][5] < top]),
            (1, left),
            (2, right),
            (0, [p for p in wide if p[0][5] > bottom]),
        ]
    lines: list[LayoutLine] = []
    for column, region in regions:
        for chars in _group(region):
            chars.sort(key=lambda c: c[1])
            spans = _spans(chars)
            if spans:
                lines.append(
                    LayoutLine(
                        left=spans,
                        top=min(c[3] for c in chars),
                        bottom=max(c[4] for c in chars),
                        page=number,
                        column=column,
                    )
                )
    for height, x0, x1 in _rules(page):
        # The closest line above the rule, among lines it runs under.
        above = [l for l in lines if l.bottom <= height + 1 and l.left[0].x0 < x1 and l.left[-1].x1 > x0]
        if above:
            line = max(above, key=lambda l: l.bottom)
            if height - line.bottom < 1.2 * line.size:  # close under it, not far below
                line.rule_below = True
    return lines


def column_edges(lines: list[LayoutLine]) -> dict[int, float]:
    """The right edge of the text in each column: where its furthest line ends.
    Full-width text (column 0) reaches the page's furthest point."""
    edges: dict[int, float] = {}
    for line in lines:
        for span in line.left + line.right:
            edges[line.column] = max(edges.get(line.column, 0.0), span.x1)
    edges[0] = max(edges.values(), default=0.0)
    return edges


def split_columns(lines: list[LayoutLine]) -> None:
    """Move right-aligned text (dates, places) into each line's right column.

    Text is right-aligned when it ends at the right edge of the text (the
    furthest any line reaches) and a wide gap comes before it: COLUMN_GAP font
    sizes, or WIDE_GAP when that gap is the only wide one on the line and the
    text after it is short. Justified text stretches every gap on a line alike,
    so one gap standing out is a column, not justification.
    """
    edges = column_edges(lines)
    for line in lines:
        edge = edges[line.column]
        spans = line.left
        gaps = [spans[i].x0 - spans[i - 1].x1 for i in range(1, len(spans))]
        for i in range(len(spans) - 1, 0, -1):
            gap = gaps[i - 1]
            size = max(spans[i].size, spans[i - 1].size)
            if spans[-1].x1 < edge - RIGHT_SLACK * size:
                break  # nothing on this line reaches the right edge
            others = [g for j, g in enumerate(gaps) if j != i - 1]
            alone = all(g < WIDE_GAP * size and 3 * g <= gap for g in others)
            after_bullet = i == 1 and spans[0].text.strip() in BULLET_SIGNS
            short = spans[-1].x1 - spans[i].x0 <= 0.4 * (edge - spans[0].x0)
            if gap >= COLUMN_GAP * size or (gap >= WIDE_GAP * size and alone and short and not after_bullet):
                line.left, line.right = spans[:i], spans[i:]
                line.left[-1].text = line.left[-1].text.rstrip()
                line.right[0].text = line.right[0].text.lstrip()
                break


def extract_resume_pdf(path: str | Path) -> ExtractedResume:
    """Read all pages and return the text, its layout and every web link."""
    layout: list[LayoutLine] = []
    with pymupdf.open(path) as doc:
        for number, page in enumerate(doc):
            layout.extend(_page_lines(page, number))
    split_columns(layout)
    # One Link per linked place, in reading order. The label is the text under
    # the link, as before; where it sits is kept in the layout.
    links: list[Link] = []
    for line in layout:
        previous = None  # the URL of the span before, on this line
        for span in line.left + line.right:
            if span.url and span.url == previous:  # one link in two styles
                links[-1].label = f"{links[-1].label} {span.text.strip()}".strip()
            elif span.url:
                links.append(Link(label=span.text.strip(), url=span.url))
            previous = span.url
    for link in links:
        link.label = link.label.strip("(),;")  # "(live," -> "live"
    return ExtractedResume(text=ResumeText(layout), links=links)


def layout_from_text(text: str) -> ResumeText:
    """Pasted text as a layout: one line per text line, no fonts.

    A tab or a run of three or more spaces before the last part of a line makes
    that part the right-hand column. An empty line leaves a gap above the next.
    """
    lines: list[LayoutLine] = []
    y = 0.0
    for raw in expand_ligatures(text).splitlines():
        if not raw.strip():
            y += 12.0  # an empty line: a visible gap, as on paper
            continue
        indent = len(raw) - len(raw.lstrip())
        parts = re.split(r"\t+| {3,}", raw.strip())
        left_text = " ".join(parts[:-1]) if len(parts) > 1 else parts[0]
        x0 = indent * 5.0
        left = [Span(text=left_text, x0=x0, x1=x0 + 5.0 * len(left_text), size=10.0)]
        right = [Span(text=parts[-1], x0=600.0, x1=600.0 + 5.0 * len(parts[-1]), size=10.0)] if len(parts) > 1 else []
        lines.append(LayoutLine(left=left, right=right, top=y, bottom=y + 10.0))
        y += 12.0
    return ResumeText(lines, from_pdf=False)
