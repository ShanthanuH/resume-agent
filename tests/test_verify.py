"""Tests for the verifier. Layer 1 needs no model; layer 2's model is faked."""

import pytest

from resume_agent import llm, verify
from resume_agent.models import Entry, EvidenceLine, TailoredBullet

# One job bullet and one project bullet. The project's tools sit in its header
# (the entry title), which is how many resumes list them.
JOB = EvidenceLine(
    id="E1",
    section="Experience",
    entry=Entry(
        title="Backend Engineer", organization="Acme Corp", dates="Jan 2022 - Present"
    ),
    text=(
        "Built a FastAPI service handling 2M requests per day, cutting p95 latency "
        "by 40% and migrating 1,015 jobs to Kubernetes"
    ),
)
PROJECT = EvidenceLine(
    id="E2",
    section="Projects",
    entry=Entry(title="Exam Helper | Python, Streamlit", dates="Sep 2024"),
    text="Built and deployed a RAG system that answers questions from a 341-page textbook",
)


def bullet(text: str) -> TailoredBullet:
    return TailoredBullet(id="B1", text=text, source_ids=["E1"], requirement_ids=["R1"])


def violations(text: str, source: EvidenceLine = JOB) -> list[str]:
    return verify.verify_rules(bullet(text), [source]).violations


# --- numbers ---------------------------------------------------------------


def test_same_numbers_in_other_spellings_pass():
    assert violations(
        "Cut p95 latency by 40 percent on a service handling 2,000,000 requests "
        "per day, migrating 1015 jobs"
    ) == []


@pytest.mark.parametrize(
    "text, wrong",
    [
        ("Cut p95 latency by 50%", "50%"),  # invented percentage
        ("Built a service handling 5M requests per day", "5M"),  # invented size
        ("Migrated 1,015 jobs in 2023", "2023"),  # invented year
        ("Cut p99 latency", "99"),  # p95 quietly became p99
    ],
)
def test_invented_numbers_are_flagged(text, wrong):
    assert violations(text) == [f'The number "{wrong}" is not in the source lines.']


def test_a_percentage_needs_a_percentage_in_the_source():
    # 95 is in the source as "p95", but never as a percentage.
    assert violations("Improved latency by 95%") == [
        'The number "95%" is not in the source lines.'
    ]


def test_numbers_from_the_entry_header_pass():
    assert violations("Built a FastAPI service since 2022") == []


# --- tools -----------------------------------------------------------------


def test_invented_tool_is_flagged():
    assert violations("Built a FastAPI and LangChain service") == [
        'The tool "LangChain" is not in the source lines.'
    ]


def test_lowercase_tool_is_flagged():
    # No capital letter, so only the skill list can catch this one.
    assert violations("Analysed request logs with pandas") == [
        'The tool "Pandas" is not in the source lines.'
    ]


def test_another_spelling_of_the_same_tool_passes():
    assert violations("Migrated jobs to K8s") == []


def test_a_tool_is_not_found_inside_a_longer_name():
    java = JOB.model_copy(update={"text": "Maintained a Java billing system"})
    assert violations("Maintained a Java billing system", java) == []
    assert violations("Maintained a JavaScript billing system", java) == [
        'The tool "JavaScript" is not in the source lines.'
    ]


def test_tool_named_only_in_the_entry_header_passes():
    assert violations("Built and deployed a RAG system in Python", PROJECT) == []


def test_tool_missing_from_line_and_header_is_flagged():
    assert violations("Built a RAG system using Python and Gemini", PROJECT) == [
        'The tool "Gemini" is not in the source lines.'
    ]


def test_ordinary_words_are_not_mistaken_for_tools():
    # "go", "rest" and "express" are words here, not Go, REST and Express.
    assert violations("Built a service to go live and express the rest of the plan") == []


# --- names -----------------------------------------------------------------


def test_invented_organization_is_flagged():
    assert violations("Built a FastAPI service for Google") == [
        'The name "Google" is not in the source lines.'
    ]


def test_organization_from_the_entry_passes():
    assert violations("Built a FastAPI service at Acme Corp") == []


def test_unknown_capitalised_tool_is_flagged_without_the_skill_list():
    assert violations("Built a FastAPI service on Zyntrix") == [
        'The name "Zyntrix" is not in the source lines.'
    ]


def test_first_word_is_not_treated_as_a_name():
    assert violations("Engineered a FastAPI service") == []


# --- titles ----------------------------------------------------------------


def test_invented_seniority_is_flagged():
    assert violations("Built a FastAPI service as senior engineer") == [
        'The title word "senior" is not in the source lines.'
    ]


def test_capitalised_title_is_reported_once():
    # "Senior" is both a capitalised word and a title word; one message is enough.
    assert violations("Built a FastAPI service as Senior Backend Engineer") == [
        'The title word "Senior" is not in the source lines.'
    ]


def test_title_from_the_entry_passes():
    assert violations("Built a FastAPI service as backend engineer") == []


def test_plural_role_words_are_not_titles():
    assert violations("Built a FastAPI service used by other developers") == []


# --- layer 2 and the two layers together ------------------------------------


def fake_judge(monkeypatch, verdicts):
    """Fake the model and count how often it is called."""
    calls = []

    def fake(**kwargs):
        calls.append(kwargs)
        return verify._VerdictBatchDraft(verdicts=verdicts)

    monkeypatch.setattr(llm, "generate_structured", fake)
    return calls


def test_judge_violations_fail_the_bullet(monkeypatch):
    fake_judge(
        monkeypatch,
        [
            verify._VerdictDraft(
                bullet_id="B1", unsupported_claims=['"demonstrated ownership"']
            )
        ],
    )
    result = verify.verify_claim(bullet("Built a FastAPI service"), [JOB])
    assert (result.passed, result.layer) == (False, "judge")
    assert result.violations == ['"demonstrated ownership"']


def test_judge_pass_passes_the_bullet(monkeypatch):
    fake_judge(monkeypatch, [verify._VerdictDraft(bullet_id="B1", unsupported_claims=[])])
    result = verify.verify_claim(bullet("Built a FastAPI service"), [JOB])
    assert (result.passed, result.layer) == (True, "judge")


def test_missing_verdict_fails_closed(monkeypatch):
    fake_judge(monkeypatch, [])  # the judge answered nothing
    result = verify.verify_claim(bullet("Built a FastAPI service"), [JOB])
    assert not result.passed


def test_rule_failures_never_reach_the_judge(monkeypatch):
    calls = fake_judge(monkeypatch, [])
    result = verify.verify_claim(bullet("Cut latency by 99%"), [JOB])
    assert (result.passed, result.layer) == (False, "rules")
    assert calls == []  # no model call was paid for
