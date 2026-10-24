"""Tests for the agent's guard rules, assembly and loop. No model is called."""

from types import SimpleNamespace

import pytest
from google.genai import types
from google.genai.errors import APIError

from resume_agent import agent, llm
from resume_agent import session as session_module
from resume_agent.assemble import build_resume, check_resume
from resume_agent.extract import Link
from resume_agent.models import (
    Entry,
    EvidenceLine,
    Requirement,
    TailoredBullet,
    Verification,
)
from resume_agent.session import MAX_ATTEMPTS, MAX_QUESTIONS, Session

ACME = Entry(title="Backend Engineer", organization="Acme Corp", dates="2022 - 2024")
LINES = [
    EvidenceLine(id="E1", section="Experience", entry=ACME, text="Built a FastAPI service"),
    EvidenceLine(id="E2", section="Experience", entry=ACME, text="Migrated jobs to Kubernetes"),
    EvidenceLine(id="E3", section="Education", entry=Entry(title="B.Tech"), text="CGPA 8.0"),
]
LINKS = [Link(label="GitHub", url="https://github.com/example")]


def make_session(answer: str = "") -> Session:
    return Session(
        evidence={e.id: e for e in LINES},
        requirements={
            "R1": Requirement(id="R1", text="FastAPI", priority="must_have"),
            "R2": Requirement(id="R2", text="LangChain", priority="nice_to_have"),
        },
        links=LINKS,
        ask_user=lambda question: answer,
    )


@pytest.fixture
def fakes(monkeypatch):
    """Replace the three model-backed tools with fakes the test can steer."""
    state = SimpleNamespace(
        matches={"R1": ["E1"], "R2": []},  # what search will find
        verdict=True,  # whether verification passes
        jobs=[],  # every rewrite job the writer was given
    )

    def search(requirements, evidence):
        return {r.id: state.matches[r.id] for r in requirements}

    def rewrite(jobs):
        state.jobs.extend(jobs)
        return [
            TailoredBullet(
                id=job.bullet_id,
                text=f"Rewritten {job.sources[0].id} v{len(state.jobs)}",
                source_ids=[s.id for s in job.sources],
                requirement_ids=[r.id for r in job.requirements],
            )
            for job in jobs
        ]

    def verify(checks):
        return {
            bullet.id: Verification(
                passed=state.verdict,
                violations=[] if state.verdict else ["The number 5 is invented."],
                layer="rules",
            )
            for bullet, _ in checks
        }

    monkeypatch.setattr(session_module, "search_all_evidence", search)
    monkeypatch.setattr(session_module, "rewrite_bullets", rewrite)
    monkeypatch.setattr(session_module, "verify_claims", verify)
    return state


def call(name, **args):
    return (name, {"reason": "test", **args})


def search_both(session):
    return session.execute(
        [
            call("search_evidence", requirement_id="R1"),
            call("search_evidence", requirement_id="R2"),
        ]
    )


# --- refusal -----------------------------------------------------------------


def test_requirement_without_evidence_becomes_a_gap(fakes):
    session = make_session()
    search_both(session)
    assert session.requirements["R2"].status == "gap"
    assert session.requirements["R1"].status == "pending"


def test_no_bullet_for_a_requirement_without_evidence(fakes):
    session = make_session()
    search_both(session)
    [out] = session.execute(
        [call("rewrite_bullet", evidence_ids=["E1"], requirement_ids=["R2"])]
    )
    assert "None of the cited lines is evidence for R2" in out["error"]
    assert fakes.jobs == []  # the writer was never called
    assert session.trace[-1].decision == "refused"


def test_no_bullet_before_searching(fakes):
    session = make_session()
    [out] = session.execute(
        [call("rewrite_bullet", evidence_ids=["E1"], requirement_ids=["R1"])]
    )
    assert out["error"] == "Call search_evidence for R1 first."


def test_search_and_rewrite_in_one_turn_runs_search_first(fakes):
    session = make_session()
    outputs = session.execute(
        [
            call("rewrite_bullet", evidence_ids=["E1"], requirement_ids=["R1"]),
            call("search_evidence", requirement_id="R1"),
        ]
    )
    assert outputs[0]["bullet_id"] == "B1"  # outputs stay in the order of the calls


# --- verification and retries --------------------------------------------------


def rewrite_e1(session):
    [out] = session.execute(
        [call("rewrite_bullet", evidence_ids=["E1"], requirement_ids=["R1"])]
    )
    return out


def test_passing_bullet_is_kept_and_covers_its_requirement(fakes):
    session = make_session()
    search_both(session)
    rewrite_e1(session)
    [out] = session.execute([call("verify_claim", bullet_id="B1")])
    assert out == {"passed": True}
    assert session.trace[-1].decision == "keep"
    assert session.requirements["R1"].status == "covered"


def test_retry_sends_violations_to_the_writer_and_stops_at_the_limit(fakes):
    fakes.verdict = False
    session = make_session()
    search_both(session)
    for attempt in range(1, MAX_ATTEMPTS + 1):
        assert rewrite_e1(session)["bullet_id"] == "B1"  # same bullet every retry
        [out] = session.execute([call("verify_claim", bullet_id="B1")])
        assert out["attempts_left"] == MAX_ATTEMPTS - attempt
    assert session.trace[-1].decision == "out of retries"
    # The first job had no violations; each retry carried the last failure.
    assert [job.violations for job in fakes.jobs] == [
        [],
        ["The number 5 is invented."],
        ["The number 5 is invented."],
    ]
    assert "has used all" in rewrite_e1(session)["error"]
    assert len(fakes.jobs) == MAX_ATTEMPTS  # the refused call never reached the writer


def test_verifier_off_passes_a_bullet_without_checking_it(fakes, monkeypatch):
    def must_not_run(checks):
        raise AssertionError("the verifier ran although it is switched off")

    monkeypatch.setattr(session_module, "verify_claims", must_not_run)
    session = make_session()
    session.verifier_on = False
    search_both(session)
    rewrite_e1(session)
    # The agent sees the same output as a real pass.
    assert session.execute([call("verify_claim", bullet_id="B1")]) == [{"passed": True}]
    assert session.verified == {"B1"}
    assert session.trace[-1].decision == "keep, verifier off"


def test_unverified_bullet_cannot_be_assembled(fakes):
    session = make_session()
    search_both(session)
    rewrite_e1(session)
    [out] = session.execute([call("assemble_resume", bullet_ids=["B1"])])
    assert "Not verified" in out["error"]
    assert session.resume is None


def test_unchanged_line_is_kept_and_counts_as_covered(fakes, monkeypatch):
    def same_text(jobs):
        return [
            TailoredBullet(
                id=j.bullet_id, text=j.sources[0].text, source_ids=["E1"], requirement_ids=["R1"]
            )
            for j in jobs
        ]

    monkeypatch.setattr(session_module, "rewrite_bullets", same_text)
    session = make_session()
    search_both(session)
    assert rewrite_e1(session)["status"] == "unchanged"
    assert session.bullets == {}
    assert session.requirements["R1"].status == "covered"


def test_dropped_bullet_leaves_the_requirement_uncovered(fakes):
    session = make_session()
    search_both(session)
    rewrite_e1(session)
    session.execute([call("verify_claim", bullet_id="B1")])
    session.execute([call("drop_bullet", bullet_id="B1")])
    assert session.requirements["R1"].status == "pending"


# --- ask_user ------------------------------------------------------------------


def test_user_answer_becomes_evidence_for_that_requirement(fakes):
    session = make_session(answer="I used LangChain for the retrieval layer")
    search_both(session)
    [out] = session.execute(
        [call("ask_user", question="Which framework?", requirement_id="R2")]
    )
    assert out["evidence_id"] == "U1"
    # Only the user's words are stored, never the agent's question.
    assert session.confirmed["U1"].text == "I used LangChain for the retrieval layer"
    [out] = session.execute(
        [call("rewrite_bullet", evidence_ids=["E1", "U1"], requirement_ids=["R2"])]
    )
    assert out["bullet_id"] == "B1"
    assert fakes.jobs[-1].sources[1].id == "U1"


@pytest.mark.parametrize("answer", ["", "no", "No.", "skip"])
def test_empty_or_negative_answer_adds_no_evidence(fakes, answer):
    session = make_session(answer=answer)
    search_both(session)
    [out] = session.execute([call("ask_user", question="Q?", requirement_id="R2")])
    assert out["evidence_id"] is None
    assert session.confirmed == {}
    assert session.requirements["R2"].status == "gap"


def test_question_limit(fakes):
    session = make_session(answer="no")
    outputs = session.execute(
        [call("ask_user", question="Q?", requirement_id="R1")] * (MAX_QUESTIONS + 1)
    )
    assert "limit" in outputs[-1]["error"]
    assert session.questions_asked == MAX_QUESTIONS


def test_user_fact_cannot_be_the_line_to_rewrite(fakes):
    session = make_session(answer="I know Go")
    search_both(session)
    session.execute([call("ask_user", question="Q?", requirement_id="R2")])
    [out] = session.execute(
        [call("rewrite_bullet", evidence_ids=["U1"], requirement_ids=["R2"])]
    )
    assert "must be a resume line" in out["error"]


# --- malformed calls -------------------------------------------------------------


def test_bad_arguments_and_unknown_tools_are_refused_not_crashed(fakes):
    session = make_session()
    outputs = session.execute(
        [("search_evidence", {"reason": "x"}), ("delete_everything", {})]
    )
    assert outputs[0]["error"].startswith("Bad arguments")
    assert outputs[1]["error"] == "Unknown tool delete_everything."


def test_crashing_tool_is_reported_to_the_agent(fakes, monkeypatch):
    def boom(requirements, evidence):
        raise RuntimeError("model overloaded")

    monkeypatch.setattr(session_module, "search_all_evidence", boom)
    session = make_session()
    [out] = session.execute([call("search_evidence", requirement_id="R1")])
    assert out["error"] == "search_evidence failed: model overloaded"


# --- assembly ----------------------------------------------------------------


def bullet(bullet_id, replaces, text):
    return TailoredBullet(
        id=bullet_id, text=text, source_ids=[replaces], requirement_ids=["R1"], replaces=replaces
    )


def test_build_resume_swaps_bullets_and_keeps_section_order():
    resume = build_resume(LINES, [bullet("B1", "E2", "Moved jobs to Kubernetes")], LINKS)
    # Sections stay in the resume's own order: Education was last, and stays last.
    assert [s.name for s in resume.sections] == ["Experience", "Education"]
    experience = resume.sections[0].entries[0].lines
    assert [(l.text, l.bullet_id) for l in experience] == [
        ("Built a FastAPI service", None),
        ("Moved jobs to Kubernetes", "B1"),
    ]
    assert check_resume(resume, LINES, [bullet("B1", "E2", "Moved jobs to Kubernetes")], LINKS) == []


def test_check_resume_catches_each_problem():
    long = bullet("B1", "E1", "Built a FastAPI service " + "and more " * 20)
    assert "one-page budget" in check_resume(build_resume(LINES, [long], LINKS), LINES, [long], LINKS)[0]

    no_links = build_resume(LINES, [], [])
    assert check_resume(no_links, LINES, [], LINKS) == [
        "The link https://github.com/example is missing."
    ]


def test_a_bullet_that_cannot_go_in_is_skipped_and_the_rest_go_through():
    good = bullet("B3", "E2", "Moved jobs to Kubernetes")
    cases = {
        "another bullet already replaces its line": [
            bullet("B1", "E1", "Built an API"), bullet("B2", "E1", "Made an API")
        ],
        "it repeats another line": [bullet("B2", "E1", "CGPA 8.0")],  # E3's text
        "it has no line to replace": [bullet("B2", "E9", "Built an API")],
    }
    for why, bullets in cases.items():
        chosen = [*bullets, good]
        resume = build_resume(LINES, chosen, LINKS)
        assert resume.skipped == {"B2": why}
        assert check_resume(resume, LINES, chosen, LINKS) == []  # nothing fails the resume
        assert "B3" in {l.bullet_id for s in resume.sections for e in s.entries for l in e.lines}


def test_a_rewrite_of_a_locked_line_never_drops_the_other_rewrites(caplog):
    # E4 is an entry header, printed as written. A rewrite of it is skipped with
    # a log line; the rewrite of E1 still goes in, both when the agent assembles
    # and when the run ran out of turns and code assembles (the fallback).
    degree = EvidenceLine(id="E4", section="Education", entry=Entry(title="M.Tech"), text="M.Tech", kind="header")
    session = make_session()
    session.evidence["E4"] = degree
    session.bullets = {
        "B1": bullet("B1", "E1", "Wrote a FastAPI service"),
        "B2": bullet("B2", "E4", "M.Tech in machine learning"),
    }
    session.verified = {"B1", "B2"}

    with caplog.at_level("WARNING", logger="resume_agent.assemble"):
        outcome = session.assemble_resume(
            [session_module.AssembleResume(bullet_ids=["B1", "B2"], reason="all verified")]
        )
    assert outcome == [("assembled", {"ok": True, "bullets_used": 2})]
    lines = [l for s in session.resume.sections for e in s.entries for l in e.lines]
    assert [(l.evidence_id, l.bullet_id) for l in lines] == [("E1", "B1"), ("E2", None), ("E3", None)]
    assert session.resume.skipped == {"B2": "the line is printed as written"}
    assert "bullet B2 skipped" in caplog.text and "M.Tech" not in caplog.text  # IDs only

    session.resume = None
    session.assemble_fallback()
    assert [l.bullet_id for s in session.resume.sections for e in s.entries for l in e.lines] == [
        "B1", None, None
    ]


# --- the loop ------------------------------------------------------------------


def scripted_agent(monkeypatch, turns):
    """Fake the agent model: each turn returns the next scripted list of calls."""
    remaining = iter(turns)

    def fake_call_agent(**kwargs):
        calls = next(remaining)
        return SimpleNamespace(
            function_calls=[
                SimpleNamespace(name=name, args=args, id=f"call-{n}")
                for n, (name, args) in enumerate(calls)
            ],
            candidates=[SimpleNamespace(content=types.Content(role="model", parts=[]))],
        )

    monkeypatch.setattr(llm, "call_agent", fake_call_agent)


def test_loop_runs_to_assembly_and_traces_every_step(fakes, monkeypatch):
    scripted_agent(
        monkeypatch,
        [
            [
                call("search_evidence", requirement_id="R1"),
                call("search_evidence", requirement_id="R2"),
            ],
            [call("rewrite_bullet", evidence_ids=["E1"], requirement_ids=["R1"])],
            [call("verify_claim", bullet_id="B1")],
            [call("assemble_resume", bullet_ids=["B1"])],
        ],
    )
    session = agent.run_agent(make_session())
    assert session.resume is not None
    assert [(s.tool, s.decision) for s in session.trace] == [
        ("agent", "call 2 tools"),
        ("search_evidence", "evidence found"),
        ("search_evidence", "gap"),
        ("agent", "call 1 tools"),
        ("rewrite_bullet", "rewritten"),
        ("agent", "call 1 tools"),
        ("verify_claim", "keep"),
        ("agent", "call 1 tools"),
        ("assemble_resume", "assembled"),
    ]
    assert [s.step for s in session.trace] == list(range(1, 10))


def test_step_limit_stops_a_looping_agent(fakes, monkeypatch):
    # An agent that searches forever and never assembles.
    scripted_agent(
        monkeypatch, [[call("search_evidence", requirement_id="R1")]] * 100
    )
    session = agent.run_agent(make_session())
    agent_turns = [s for s in session.trace if s.tool == "agent"]
    assert len(agent_turns) == agent.MAX_TURNS
    # The code still finishes the job, with the original resume.
    assert session.resume is not None
    assert session.trace[-1].decision == "fallback"


# --- retry with backoff ----------------------------------------------------------


def test_backoff_retries_temporary_errors_only(monkeypatch):
    waits = []
    monkeypatch.setattr(llm.time, "sleep", waits.append)

    failures = iter([APIError(503, {}), APIError(429, {})])

    def flaky():
        error = next(failures, None)
        if error:
            raise error
        return "ok"

    assert llm._with_backoff(flaky) == "ok"
    assert waits == llm.RETRY_DELAYS

    def bad_request():
        raise APIError(400, {})

    waits.clear()
    with pytest.raises(APIError):
        llm._with_backoff(bad_request)
    assert waits == []  # a permanent error is not retried


# --- cost ------------------------------------------------------------------------


def test_usage_since_prices_only_what_was_used_after_the_snapshot(monkeypatch):
    monkeypatch.setattr(llm, "PRICES", {"flash": (1.0, 4.0)})
    monkeypatch.setattr(llm, "USAGE", {"flash": [1, 1000, 500]})
    snapshot = llm.usage_snapshot()
    llm.USAGE["flash"] = [2, 3000, 1500]  # one more call: 2000 in, 1000 out
    tokens_in, tokens_out, cost = llm.usage_since(snapshot)
    assert (tokens_in, tokens_out) == (2000, 1000)
    assert cost == pytest.approx((2000 * 1.0 + 1000 * 4.0) / 1_000_000)


def test_cost_is_unknown_when_a_model_has_no_price(monkeypatch):
    monkeypatch.setattr(llm, "PRICES", {})
    monkeypatch.setattr(llm, "USAGE", {"mystery": [1, 10, 10]})
    assert llm.usage_since({})[2] is None
