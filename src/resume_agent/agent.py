"""The agent loop (spec section 3): a ReAct loop on Gemini function calling.

ReAct means "reason, then act", repeated:
  1. the model reads the conversation so far and picks tools to call
  2. our code runs those tools
  3. the results are added to the conversation
and round again, until the resume is assembled or the step limit is hit.

No framework: the conversation is a plain list, and the loop is a for loop.
"""

import argparse
import json
import time
from pathlib import Path

from google.genai import types

from resume_agent import llm
from resume_agent.extract import Link, extract_resume_pdf
from resume_agent.parsing import parse_jd, parse_resume
from resume_agent.session import MAX_ATTEMPTS, MAX_QUESTIONS, AskUser, Session

MAX_TURNS = 12  # agent turns per run. Stops a confused agent from looping forever.

AGENT_SYSTEM = f"""You tailor a resume to a job description by calling tools.
You see requirement IDs and evidence IDs with short texts. You never write resume
text yourself: the rewrite_bullet tool does that.

Work in this order:
1. Call search_evidence for the requirements worth working on. Call
   reject_requirement for any that no resume line could honestly show.
2. For each resume line that is evidence for something, call rewrite_bullet once,
   with every requirement that line supports. Never ask for a bullet for a
   requirement without evidence: missing skills are reported as gaps, not invented.
3. Call verify_claim for every bullet that came back rewritten.
4. For each failed bullet choose: rewrite_bullet again (a line gets
   {MAX_ATTEMPTS} attempts in total), drop_bullet, or ask_user when the resume
   is unclear about a fact (at most {MAX_QUESTIONS} questions per run).
5. Call assemble_resume with the verified bullets to include. Coverage of
   must_have requirements comes first. If it reports a problem, fix that and
   call it again.

Rules:
- Put all calls of the same step in ONE turn: every search together, every
  rewrite together, every verify together. Each turn is slow and costs money.
- Every call needs a short reason. It is shown to the user as your decision.
- Tool results are final. If a tool refuses, do not repeat the same call."""


def declarations(session: Session) -> list[types.FunctionDeclaration]:
    """Describe each tool to Gemini, straight from its argument model."""
    return [
        types.FunctionDeclaration(
            name=name,
            description=args_model.__doc__,
            parameters_json_schema=args_model.model_json_schema(),
        )
        for name, (args_model, _) in session.tools().items()
    ]


def start_session(
    resume_text: str, jd_text: str, links: list[Link], ask_user: AskUser
) -> Session:
    """Parse both texts and return a Session ready for the agent.

    Parsing always happens and always comes first, so it is done here in code
    and not left for the agent to ask for. It is still logged in the trace.
    """
    steps = []
    for tool, parse, text in [
        ("parse_resume", parse_resume, resume_text),
        ("parse_jd", parse_jd, jd_text),
    ]:
        snapshot = llm.usage_snapshot()
        started = time.perf_counter()
        items = parse(text)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        steps.append((tool, len(text), items, elapsed_ms, llm.usage_since(snapshot)))
    session = Session(
        evidence={e.id: e for e in steps[0][2]},
        requirements={r.id: r for r in steps[1][2]},
        links=links,
        ask_user=ask_user,
    )
    for tool, chars, items, elapsed_ms, (tokens_in, tokens_out, cost) in steps:
        session.log(
            tool,
            {"characters": chars},
            {"items": len(items)},
            "parsed",
            elapsed_ms,
            tokens_in,
            tokens_out,
            cost,
        )
    return session


def _briefing(session: Session) -> str:
    """The agent's first message: every requirement and evidence line, in short."""
    requirements = "\n".join(
        f"{r.id} | {r.priority} | {r.text}" for r in session.requirements.values()
    )
    evidence = "\n".join(
        # Short texts only (spec: the agent "sees IDs and short texts"). The
        # writer and the verifier get the full lines; the agent only routes.
        f"{e.id} | {e.section} | {e.entry.title[:60]} | {e.text[:110]}"
        for e in session.evidence.values()
    )
    return (
        "Requirements (id | priority | text):\n"
        + llm.wrap_untrusted("requirement", requirements)
        + "\nResume lines (id | section | entry | text):\n"
        + llm.wrap_untrusted("evidence", evidence)
    )


def run_agent(session: Session) -> Session:
    """Run the loop until the resume is assembled or MAX_TURNS is reached."""
    tools = declarations(session)
    # The whole conversation. It only ever grows: Gemini is stateless, so every
    # turn re-sends all of it.
    contents = [
        types.Content(role="user", parts=[types.Part(text=_briefing(session))])
    ]
    for turn in range(1, MAX_TURNS + 1):
        # --- 1. Reason: the model picks tools ---
        snapshot = llm.usage_snapshot()
        started = time.perf_counter()
        response = llm.call_agent(
            system=AGENT_SYSTEM, contents=contents, declarations=tools
        )
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        calls = response.function_calls or []
        session.log(
            "agent",
            {"turn": turn},
            {"calls": [call.name for call in calls]},
            f"call {len(calls)} tools" if calls else "no tool call",
            elapsed_ms,
            *llm.usage_since(snapshot),
        )
        if not calls:  # blocked or empty answer: nothing to act on, so stop
            break
        # The model's own message goes back into the conversation unchanged. It
        # carries hidden "thought signatures" that Gemini needs to see again.
        contents.append(response.candidates[0].content)

        # --- 2. Act: our code runs them ---
        outputs = session.execute([(call.name, dict(call.args or {})) for call in calls])

        # --- 3. Observe: results go back, one per call, matched by id ---
        contents.append(
            types.Content(
                role="user",
                parts=[
                    types.Part(
                        function_response=types.FunctionResponse(
                            id=call.id, name=call.name, response=output
                        )
                    )
                    for call, output in zip(calls, outputs)
                ],
            )
        )
        if session.resume is not None:  # assemble_resume succeeded: done
            break
    if session.resume is None:  # out of turns: finish in code with what passed
        session.assemble_fallback()
    return session


# --- command line ------------------------------------------------------------


def _ask_in_terminal(question: str) -> str:
    print(f"\nThe agent asks: {question}")
    return input("Your answer (Enter to skip): ")


def main() -> None:
    parser = argparse.ArgumentParser(description="Tailor a resume to a JD.")
    parser.add_argument("resume", type=Path, help="resume as .pdf or .txt")
    parser.add_argument("jd", type=Path, help="job description as .txt")
    parser.add_argument(
        "--no-questions", action="store_true", help="answer every ask_user with nothing"
    )
    parser.add_argument("--trace", type=Path, help="write the full trace as JSON here")
    args = parser.parse_args()

    if args.resume.suffix.lower() == ".pdf":
        extracted = extract_resume_pdf(args.resume)
        resume_text, links = extracted.text, extracted.links
    else:
        resume_text, links = args.resume.read_text(), []
    ask_user = (lambda question: "") if args.no_questions else _ask_in_terminal

    session = start_session(resume_text, args.jd.read_text(), links, ask_user)
    run_agent(session)

    print("\nTRACE")
    for step in session.trace:
        # Show the IDs a step was about, without the long reason text.
        about = ", ".join(
            str(v if not isinstance(v, list) else "+".join(v))
            for k, v in step.input.items()
            if k.endswith(("_id", "_ids"))
        )
        print(
            f"{step.step:>3} {step.tool:<18} {step.decision:<15} {about:<22} "
            f"{step.latency_ms:>6} ms {step.tokens_in + step.tokens_out:>6} tok"
        )
        if step.input.get("reason"):
            print(f"      why: {step.input['reason']}")

    print("\nPROPOSED CHANGES")
    for bullet in session.bullets.values():
        print(f"{bullet.id} for {', '.join(bullet.requirement_ids)}")
        print(f"  old: {session.evidence[bullet.replaces].text}")
        print(f"  new: {bullet.text}")
        print(f"  based on: {', '.join(bullet.source_ids)}")

    print("\nREQUIREMENTS")
    for req in session.requirements.values():
        print(f"  {req.id} {req.status:<8} {req.priority:<13} {req.text}")

    print("\nMODEL USAGE")
    for model, (calls, tokens_in, tokens_out) in llm.USAGE.items():
        print(f"  {model}: {calls} calls, {tokens_in} tokens in, {tokens_out} out")

    if args.trace:
        args.trace.write_text(
            json.dumps([step.model_dump() for step in session.trace], indent=2)
        )


if __name__ == "__main__":
    main()
