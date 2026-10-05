"""Rung 1 demo: resume PDF and JD in, tailored bullets with source IDs out.

This is a fixed straight-line script, not the agent loop. It makes no decisions,
does no verification and never retries. It exists to try the tools on real input.
"""

import argparse
import time
from pathlib import Path

from resume_agent.extract import extract_resume_pdf
from resume_agent.models import TailoredBullet
from resume_agent.parsing import parse_jd, parse_resume
from resume_agent.tools import rewrite_bullet, search_evidence


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("resume", type=Path, help="resume as .pdf or .txt")
    parser.add_argument("jd", type=Path, help="job description as .txt")
    parser.add_argument(
        "--delay",
        type=float,
        default=0.0,
        help="seconds to wait between model calls (helps with free-tier rate limits)",
    )
    args = parser.parse_args()

    if args.resume.suffix.lower() == ".pdf":
        resume_text = extract_resume_pdf(args.resume).text
    else:  # the paste-text fallback from the spec
        resume_text = args.resume.read_text()
    jd_text = args.jd.read_text()

    evidence = parse_resume(resume_text)
    requirements = parse_jd(jd_text)
    by_id = {e.id: e for e in evidence}  # lets us turn IDs back into lines
    print(f"{len(evidence)} evidence lines, {len(requirements)} requirements\n")

    bullets: list[TailoredBullet] = []
    for req in requirements:
        time.sleep(args.delay)
        ids = search_evidence(req, evidence)
        if not ids:  # no evidence: record a gap, never invent a bullet
            req.status = "gap"
            continue
        time.sleep(args.delay)
        bullet = rewrite_bullet(
            [by_id[i] for i in ids], [req], bullet_id=f"B{len(bullets) + 1}"
        )
        bullets.append(bullet)
        print(f"{bullet.id} for {req.id} ({req.priority}): {req.text}")
        print(f"  new:  {bullet.text}")
        for i in bullet.source_ids:
            # "*" marks the original line the writer says this bullet replaces
            mark = "*" if i == bullet.replaces else " "
            print(f"  {mark}{i}: {by_id[i].text}")
        print()

    gaps = [r for r in requirements if r.status == "gap"]
    print(f"Gaps ({len(gaps)}):")
    for r in gaps:
        print(f"  {r.id} ({r.priority}): {r.text}")


if __name__ == "__main__":
    main()
