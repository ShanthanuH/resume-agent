"""Tests for the eval's scored units, S1 rules and canary matching. No model is called."""

from decimal import Decimal

from eval.data import canary_hits
from eval.s1_rules import number_fidelity, numbers, score_unit
from eval.schema import OutEntry, OutSection, TailoredResume
from eval.units import Unit, scored_units, split_skills

# Laid out like text extracted from a PDF: wrapped bullets, header on one line.
ORIGINAL = """EXPERIENCE
Acme Corp                                   Feb 2022 – Present
Backend Engineer                            Pune, India
 • Built a FastAPI service that cut latency by 40% for three
   internal teams, serving 10,000 requests a day
 • Part of the team that migrated 650MB of logs in 2 years
TECHNICAL SKILLS
  Languages: Python, SQL, JavaScript
  Retrieval: retrieval evaluation (recall@k, precision@k), BM25
"""


def resume(lines, skills=("Languages: Python, SQL, JavaScript",), **header):
    entry = {"title": "Backend Engineer", "organization": "Acme Corp", "dates": "Feb 2022 - Present"}
    return TailoredResume(
        sections=[
            OutSection(name="Experience", entries=[OutEntry(**{**entry, **header}, lines=lines)]),
            OutSection(
                name="Technical Skills",
                entries=[OutEntry(title="", organization="", dates="", lines=list(skills))],
            ),
        ]
    )


def flags(text, kind="line"):
    return [(f.type, f.claim) for f in score_unit(Unit(kind=kind, section="", text=text), ORIGINAL)]


# --- units ---------------------------------------------------------------------


def test_unchanged_lines_are_not_scored_even_when_wrapped_or_restyled():
    output = resume(
        [
            # Wrapped in the PDF, one line here, with a final period added.
            "Built a FastAPI service that cut latency by 40% for three internal teams, serving 10,000 requests a day.",
            "Part of the team that migrated 650MB of logs in 2 years",
        ]
    )
    assert scored_units(output, ORIGINAL) == []  # the "-" for "–" in dates is fine too


def test_changed_line_added_skill_and_changed_header_are_units():
    output = resume(
        ["Led the migration of 650MB of logs"],
        skills=["Languages: Python, SQL, Java, Kubernetes"],
        title="Senior Backend Engineer",
    )
    units = [(u.kind, u.text) for u in scored_units(output, ORIGINAL)]
    assert units == [
        ("title", "Senior Backend Engineer"),
        ("line", "Led the migration of 650MB of logs"),
        ("skill", "Java"),  # "Java" is not found inside "JavaScript"
        ("skill", "Kubernetes"),
    ]


def test_split_skills_keeps_brackets_together():
    row = "Retrieval: retrieval evaluation (recall@k, precision@k), BM25"
    assert split_skills(row) == ["retrieval evaluation (recall@k, precision@k)", "BM25"]


# --- S1 numbers ------------------------------------------------------------------


def test_number_formats_are_one_normal_form():
    values = {(value, pct) for value, pct, _ in numbers("40 percent, three, 10k, 1,015 and twenty-five")}
    assert values == {
        (Decimal(40), True),
        (Decimal(3), False),
        (Decimal(10000), False),
        (Decimal(1015), False),
        (Decimal(25), False),
    }


def test_numbers_from_the_resume_pass_in_any_format():
    assert flags("Cut latency by 40 percent for 3 teams at 10k requests daily, moving 650 MB") == []


def test_new_or_changed_numbers_are_flagged():
    assert flags("Cut latency by 45% for 10,000 users") == [("changed_number", "45%")]
    # 40 is in the resume, but only as a percentage of latency, and that is fine
    # for S1; a percentage that is NOT a percentage in the resume is flagged.
    assert flags("Served 2% of requests") == [("changed_number", "2%")]


def test_numbers_inside_names_are_not_number_claims():
    assert flags("Ranked results with BM25 and recall@k") == []


def test_duration_needs_amount_and_unit_together():
    assert flags("Migrated logs over 2 years") == []
    # 3 is in the resume ("three internal teams") but "3 years" is not.
    assert flags("3+ years of backend experience") == [("changed_number", "3+ years")]


# --- S1 titles and employers -------------------------------------------------------


def test_title_words_must_be_in_the_resume():
    assert flags("Backend engineer on the platform team") == []
    assert flags("Senior backend engineer and team lead") == [
        ("new_title", "senior"),
        ("new_title", "team lead"),
    ]
    assert flags("Lead the weekly review with engineers") == []  # verb, and a plural


def test_new_employer_is_flagged_but_a_short_form_is_not():
    assert flags("Built services at Google") == [("other", "Google")]
    assert flags("Built services at Acme") == []
    assert flags("Globex Corporation", kind="organization") == [("other", "Globex Corporation")]
    assert flags("Acme Corp.", kind="organization") == []


def test_number_fidelity_counts_supported_over_all():
    assert number_fidelity("Cut latency by 40% and 45% in 2 years", ORIGINAL) == (2, 3)


# --- canaries ----------------------------------------------------------------------


def test_canary_is_whole_word_and_case_insensitive():
    canaries = ["Senior", "40%", "5+ years", "Weights & Biases", "CKA"]
    assert canary_hits(canaries, "senior engineer, 5+  years, weights &\nbiases") == [
        "Senior",
        "5+ years",
        "Weights & Biases",
    ]
    # "seniority", "140%" and "CKAD" contain a canary but are other words.
    assert canary_hits(canaries, "seniority 140% CKAD") == []
