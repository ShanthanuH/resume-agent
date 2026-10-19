"""Data models from spec.md section 7."""

from typing import Any, Literal

from pydantic import BaseModel


class Mark(BaseModel):
    """Bold, italic or a link on part of a line: the n-th time `text` appears in it.

    Marks name their words instead of character offsets, so they survive the
    contact details being swapped for placeholders and back, and can be found
    again in a rewritten line.
    """

    text: str
    n: int = 0  # 0 is the first occurrence of `text` in the line
    bold: bool = False
    italic: bool = False
    url: str | None = None


class Styled(BaseModel):
    """A piece of text as written, with its bold, italic and linked words."""

    text: str = ""
    marks: list[Mark] = []


class HeaderLine(BaseModel):
    """One line of an entry header as written: left text, and the right-hand
    column that holds dates or a location."""

    left: Styled = Styled()
    right: Styled = Styled()


class Entry(BaseModel):
    """The parent block a resume line sits under, e.g. one job or one degree."""

    # All default to "" because sections like Skills have no title or dates.
    title: str = ""
    organization: str = ""
    dates: str = ""
    location: str = ""
    # The header exactly as printed, one item per line. The fields above are
    # read from it; the PDF and the preview draw these lines, not the fields.
    header_lines: list[HeaderLine] = []


# How a line sits on the page:
#   bullet    a bulleted line
#   line      a line on its own without a bullet, e.g. a skills row
#   sentence  one sentence of a paragraph, e.g. the summary
#   header    the left text of an entry header, kept so the matcher can see an
#             entry with no lines under it (a degree, say). Never rewritten.
#   fixed     a line that fit no pattern, kept as written. Never rewritten.
LineKind = Literal["bullet", "line", "sentence", "header", "fixed"]
LOCKED_KINDS = {"header", "fixed"}  # kinds that are printed as written, always


class EvidenceLine(BaseModel):
    """One verbatim line from the resume. The only source of truth for claims."""

    id: str  # assigned in code ("E1", "E2", ...), never by the model
    section: str
    entry: Entry
    text: str  # must be a substring of the resume text
    kind: LineKind = "bullet"
    join: bool = False  # True: continues the paragraph of the line before it
    marks: list[Mark] = []  # bold, italic and links inside `text`


class Requirement(BaseModel):
    """One single thing the JD asks for."""

    id: str  # assigned in code ("R1", "R2", ...)
    text: str
    priority: Literal["must_have", "nice_to_have"]
    status: Literal["covered", "gap", "pending"] = "pending"


class TailoredBullet(BaseModel):
    """A rewritten bullet, with the bookkeeping that ties it to its sources."""

    id: str  # assigned in code ("B1", "B2", ...)
    text: str  # the only field the writer model controls freely
    source_ids: list[str]  # set in code from the evidence passed in
    requirement_ids: list[str]  # set in code from the requirements passed in
    replaces: str | None = None  # an EvidenceLine id, validated in code
    status: Literal["proposed", "approved", "rejected"] = "proposed"


class Verification(BaseModel):
    """The result of checking one bullet against its cited source lines."""

    passed: bool
    violations: list[str] = []  # one plain sentence per problem, fed to the retry
    layer: Literal["rules", "judge"]  # which check produced this result


class TraceStep(BaseModel):
    """One line of the agent trace: what was called, what came back, what it cost."""

    step: int  # 1, 2, 3, ... in the order things happened
    tool: str  # a tool name, or "agent" for a turn of the deciding model
    input: dict[str, Any]
    output: dict[str, Any]
    decision: str  # the outcome in a word or two: "keep", "retry", "gap", ...
    latency_ms: int
    tokens_in: int = 0
    tokens_out: int = 0
    cost: float | None = None  # US dollars; None while llm.PRICES has no price
