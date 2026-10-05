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
            for link in page.get_links():
                if link["kind"] != pymupdf.LINK_URI:  # skip internal page jumps
                    continue
                # link["from"] is the clickable rectangle; read the text under it.
                label = page.get_textbox(link["from"]).strip()
                links.append(Link(label=label, url=link["uri"]))
    return ExtractedResume(text="\n".join(pages), links=links)
