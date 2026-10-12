"""Check the eval data before any money is spent. Run: uv run python -m eval.validate

Checks (spec A2): every file parses, every required header is present, the
counts are right, no JD appears twice, and no canary is already in the resume
it is paired with. A canary that is already in the resume would fail every
system, so the test would measure nothing.
"""

import hashlib
import sys
from collections import Counter

from resume_agent.parsing import normalize

from eval.data import ATTACKS, DATA, Case, canary_hits, load_resume, parse_jd_file

REQUIRED = {
    "real": ["url", "collected", "resume", "fit"],
    "adversarial": ["attack", "canary", "resume"],
}
RESUMES = ["R1", "R2", "R3"]
MIN_JD_CHARS = 300  # shorter than this means the body is missing or cut off


def check_case(case: Case) -> list[str]:
    """Problems with one file, judged by itself."""
    problems = [
        f"missing header '{key}'"
        for key in REQUIRED[case.kind]
        if not case.header.get(key)
    ]
    if case.resume_id not in RESUMES:
        problems.append(f"unknown resume '{case.resume_id}'")
    if len(case.jd_text) < MIN_JD_CHARS:
        problems.append(f"JD body is only {len(case.jd_text)} characters")
    if case.kind == "real":
        if case.fit not in ("good", "stretch"):
            problems.append(f"fit is '{case.fit}', not good or stretch")
        if not case.id.startswith(case.resume_id + "_"):  # R2_05_... must say R2
            problems.append("file name and 'resume' header disagree")
    else:
        if case.attack not in ATTACKS:
            problems.append(f"unknown attack '{case.attack}'")
        if case.resume_id != "R1":  # the spec pairs every attack with R1
            problems.append("adversarial JDs must use R1")
        if case.resume_id in RESUMES:
            # The canary check, against the CURRENT resume file.
            for canary in canary_hits(case.canaries, load_resume(case.resume_id).text):
                problems.append(f"canary '{canary}' is already in {case.resume_id}")
    return problems


def check_set(cases: list[Case]) -> list[str]:
    """Problems that only show when the files are looked at together."""
    problems: list[str] = []
    real = [c for c in cases if c.kind == "real"]
    adversarial = [c for c in cases if c.kind == "adversarial"]

    # Counts: 10 real JDs per resume as 7 good + 3 stretch, 2 JDs per attack.
    fits = Counter((c.resume_id, c.fit) for c in real)
    for resume_id in RESUMES:
        got = (fits[resume_id, "good"], fits[resume_id, "stretch"])
        if got != (7, 3):
            problems.append(f"{resume_id}: {got[0]} good + {got[1]} stretch, want 7 + 3")
    attacks = Counter(c.attack for c in adversarial)
    for attack in ATTACKS:
        if attacks[attack] != 2:
            problems.append(f"attack {attack}: {attacks[attack]} JDs, want 2")

    # Duplicates: the same URL twice, or the same body twice. The body is
    # compared as a hash of its normalized, lower-cased text, so a copy that
    # differs only in spacing or capitals is still caught.
    seen: dict[str, str] = {}
    for case in cases:
        keys = [hashlib.sha256(normalize(case.jd_text).lower().encode()).hexdigest()]
        # An adversarial JD may reuse its base posting's URL with another
        # adversarial JD (two attacks per base), so only real URLs must be unique.
        if case.kind == "real" and case.header.get("url"):
            keys.append(case.header["url"])
        for key in keys:
            if key in seen:
                problems.append(f"{case.id} duplicates {seen[key]}")
            seen[key] = case.id
    # An attack built on a posting that is also a real JD would leak between sets.
    real_urls = {c.header.get("url") for c in real}
    for case in adversarial:
        if case.header.get("base_url") in real_urls:
            problems.append(f"{case.id}: its base posting is also a real JD")
    return problems


def main() -> None:
    cases: list[Case] = []
    problems: list[str] = []
    for kind in ("real", "adversarial"):
        for path in sorted((DATA / "jds" / kind).glob("*.txt")):
            try:
                cases.append(parse_jd_file(path, kind))
            except ValueError as err:  # a file that does not parse
                problems.append(str(err))
    for case in cases:
        problems += [f"{case.id}: {p}" for p in check_case(case)]
    problems += check_set(cases)

    print(f"{'group':<24}{'files':>6}{'good':>6}{'stretch':>8}{'canaries':>9}")
    groups = [(r, "real") for r in RESUMES] + [(a, "adversarial") for a in ATTACKS]
    for name, kind in groups:
        # A real group is one resume; an adversarial group is one attack type.
        members = [
            c for c in cases if c.kind == kind and name in (c.resume_id, c.attack)
        ]
        good = sum(c.fit == "good" for c in members)
        stretch = sum(c.fit == "stretch" for c in members)
        canaries = sum(len(c.canaries) for c in members)
        print(f"{kind + ' ' + name:<24}{len(members):>6}{good:>6}{stretch:>8}{canaries:>9}")
    for resume_id in RESUMES:
        text = load_resume(resume_id).text
        print(f"resume {resume_id}: {len(text)} characters, {len(text.split())} words")

    print(f"\n{len(cases)} files, {len(problems)} problems")
    for problem in problems:
        print(f"  PROBLEM {problem}")
    sys.exit(1 if problems else 0)  # non-zero so a script can stop on bad data


if __name__ == "__main__":
    main()
