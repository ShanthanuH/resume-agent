"""Run the agent once on the sample resume and save everything the example page needs.

    uv run python -m resume_agent.api.make_example \
        examples/sample_resume.txt examples/sample_jd.txt web/public/example

Writes <out>.json (the steps and the result, exactly what a live run streams)
and <out>.pdf (all changes accepted). This makes real model calls and costs money.
"""

import json
import sys
import time
from pathlib import Path

from resume_agent import llm
from resume_agent.agent import run_agent, start_session
from resume_agent.api.payload import build_result, describe_step, restore_all
from resume_agent.api.redact import redact
from resume_agent.api.render import ResumeDoc, render_pdf, split_header


def accept_all(result: dict) -> ResumeDoc:
    """The resume with every proposed bullet accepted, ready to render."""
    text = {b["id"]: b["text"] for b in result["bullets"]}
    return ResumeDoc(
        header=result["header"],
        links=result["links"],
        sections=[
            {
                "name": section["name"],
                "entries": [
                    {
                        **{k: entry[k] for k in ("title", "organization", "dates")},
                        # A rewritten line shows its bullet; any other its original.
                        "lines": [
                            text.get(line["bullet_id"], line["original"])
                            for line in entry["lines"]
                        ],
                    }
                    for entry in section["entries"]
                ],
            }
            for section in result["sections"]
        ],
    )


def main() -> None:
    resume_path, jd_path, out = (Path(arg) for arg in sys.argv[1:4])
    safe_text, found = redact(resume_path.read_text())
    started = time.monotonic()
    session = start_session(safe_text, jd_path.read_text(), [], lambda question: "")
    run_agent(session)
    header = split_header(safe_text, list(session.evidence.values()))
    result = restore_all(build_result(session, header, time.monotonic() - started), found)
    steps = [restore_all(describe_step(s, session), found) for s in session.trace]
    out.with_suffix(".json").write_text(json.dumps({"steps": steps, "result": result}, indent=1))
    data, pages = render_pdf(accept_all(result))
    out.with_suffix(".pdf").write_bytes(data)
    print(f"{len(steps)} steps, {len(result['bullets'])} bullets, PDF pages: {pages}")
    print("stats:", result["stats"])
    for model, (calls, tokens_in, tokens_out) in llm.USAGE.items():
        print(f"  {model}: {calls} calls, {tokens_in} tokens in, {tokens_out} out")


if __name__ == "__main__":
    main()
