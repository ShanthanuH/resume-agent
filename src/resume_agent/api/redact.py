"""Swap contact details for placeholders before any model call, and back after.

The model never needs an email address or a phone number to tailor a resume, so
it never sees them. Each one becomes a placeholder like [EMAIL_1]; the real
values stay in this process and are put back when the result is built.
"""

import re

# Order matters: links are found before emails and phones, so the digits inside
# a URL are already gone when the phone pattern runs.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # A URL with a scheme or "www.", or a bare profile path on a common site.
    (
        "LINK",
        re.compile(
            r"(?:https?://|www\.)[^\s|,;)]+"
            r"|\b(?:linkedin\.com|github\.com|gitlab\.com)/[^\s|,;)]+",
            re.IGNORECASE,
        ),
    ),
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")),
    # A run of digits with the usual phone punctuation. Checked again in code
    # below, because this shape also matches things that are not phones.
    ("PHONE", re.compile(r"(?<![\w/])\+?\d[\d\s().-]{7,}\d(?![\w/])")),
]

# Phone numbers have 10 to 15 digits (E.164). A year range like "2019 - 2023"
# has 8, so it is left alone.
_PHONE_DIGITS = range(10, 16)


def redact(text: str) -> tuple[str, dict[str, str]]:
    """Return the text with placeholders, and placeholder -> original value."""
    found: dict[str, str] = {}
    for kind, pattern in _PATTERNS:

        def swap(match: re.Match[str], kind: str = kind) -> str:
            value = match.group(0)
            if kind == "PHONE" and sum(c.isdigit() for c in value) not in _PHONE_DIGITS:
                return value  # not a phone number: keep the text as it is
            # Reuse the placeholder when the same value appears twice.
            for placeholder, known in found.items():
                if known == value:
                    return placeholder
            count = sum(1 for p in found if p.startswith(f"[{kind}_")) + 1
            placeholder = f"[{kind}_{count}]"
            found[placeholder] = value
            return placeholder

        text = pattern.sub(swap, text)
    return text, found


def restore(text: str, found: dict[str, str]) -> str:
    """Put the original values back in place of their placeholders."""
    for placeholder, value in found.items():
        text = text.replace(placeholder, value)
    return text
