"""Resume PDF to text and hyperlinks, using PyMuPDF."""

from pathlib import Path

import pymupdf
from pydantic import BaseModel


class Link(BaseModel):
    label: str  # the visible text the link sits on, e.g. "GitHub"
    url: str


class ExtractedResume(BaseModel):
    text: str
    links: list[Link]


def extract_resume_pdf(path: str | Path) -> ExtractedResume:
    """Read all pages and return the text plus every web link."""
    pages: list[str] = []
    links: list[Link] = []
    with pymupdf.open(path) as doc:
        for page in doc:
            # sort=True orders text top to bottom, left to right. Without it,
            # PDFs often return text in the order it was drawn, which scrambles lines.
            pages.append(page.get_text("text", sort=True))
            # Each word is (x0, y0, x1, y1, text, ...): its box, then the word.
            words = page.get_text("words")
            for link in page.get_links():
                if link["kind"] != pymupdf.LINK_URI:  # skip internal page jumps
                    continue
                rect = link["from"]  # the clickable rectangle
                # Keep a word only if its centre is inside the rectangle. Link
                # rectangles often overlap the next line a little, so "any overlap"
                # would pull in pieces of neighbouring text.
                inside = [
                    w[4]
                    for w in words
                    if rect.contains(pymupdf.Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2))
                ]
                # Drop brackets and commas around the label, e.g. "(live," -> "live".
                label = " ".join(inside).strip("(),;")
                links.append(Link(label=label, url=link["uri"]))
    return ExtractedResume(text="\n".join(pages), links=links)
