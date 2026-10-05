"""Rung 1 demo: resume PDF and JD in, tailored bullets with source IDs out.

This is a fixed straight-line script, not the agent loop. It makes no decisions,
does no verification and never retries. It exists to try the tools on real input.
It makes four model calls: parse resume, parse JD, match, rewrite.
"""

import argparse
from pathlib import Path

from resume_agent import llm
from resume_agent.extract import extract_resume_pdf
from resume_agent.parsing import normalize, parse_jd, parse_resume
from resume_agent.tools import RewriteJob, rewrite_bullets, search_all_evidence


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("resume", type=Path, help="resume as .pdf or .txt")
    parser.add_argument("jd", type=Path, help="job description as .txt")
    args = parser.parse_args()

    if args.resume.suffix.lower() == ".pdf":
        resume_text = extract_resume_pdf(args.resume).text
    else:  # the paste-text fallback from the spec
        resume_text = args.resume.read_text()
    jd_text = args.jd.read_text()

    # Calls 1 and 2: turn both texts into structured lists.
    evidence = parse_resume(resume_text)
    requirements = parse_jd(jd_text)
    req_by_id = {r.id: r for r in requirements}
    print(f"{len(evidence)} evidence lines, {len(requirements)} requirements\n")

    # Call 3: which resume lines support which requirement.
    matches = search_all_evidence(requirements, evidence)
    for req in requirements:
        if not matches[req.id]:  # no evidence: record a gap, never invent a bullet
            req.status = "gap"

    # Flip the mapping from "requirement -> lines" to "line -> requirements", so
    # each resume line is rewritten once, aimed at everything it supports.
    # (Stand-in for the agent's choice of what to work on.)
    targets: dict[str, list[str]] = {}
    for req_id, evidence_ids in matches.items():
        for evidence_id in evidence_ids:
            targets.setdefault(evidence_id, []).append(req_id)

    jobs = [
        RewriteJob(
            bullet_id=f"B{n}",
            sources=[line],
            requirements=[req_by_id[i] for i in targets[line.id]],
        )
        # Loop over evidence, not targets, to keep the resume's original order.
        for n, line in enumerate((e for e in evidence if e.id in targets), start=1)
    ]

    # Call 4: write every bullet at once.
    bullets = {b.id: b for b in rewrite_bullets(jobs)} if jobs else {}

    for job in jobs:
        line = job.sources[0]
        req_ids = ", ".join(r.id for r in job.requirements)
        bullet = bullets.get(job.bullet_id)
        if bullet is None:
            print(f"{job.bullet_id} [{line.id}] no bullet returned (for {req_ids})")
        elif normalize(bullet.text) == normalize(line.text):
            # Same words as the original, so there is nothing to propose.
            print(f"{job.bullet_id} [{line.id}] kept as is (for {req_ids})")
            print(f"  {line.text}")
        else:
            print(f"{job.bullet_id} [{line.id}] rewritten (for {req_ids})")
            print(f"  old: {line.text}")
            print(f"  new: {bullet.text}")
        print()

    print("Requirements:")
    for req in requirements:
        found = ", ".join(matches[req.id]) or "GAP"
        print(f"  {req.id} ({req.priority}): {req.text} -> {found}")

    print("\nModel usage:")
    for model, (calls, tokens_in, tokens_out) in llm.USAGE.items():
        print(f"  {model}: {calls} calls, {tokens_in} tokens in, {tokens_out} out")


if __name__ == "__main__":
    main()
