"""Saved results on disk. A file that exists is a finished case and is never re-run."""

from pathlib import Path

from pydantic import BaseModel


def path(folder: Path, system: str, case_id: str, run: int) -> Path:
    """Where one (system, case, run) lives, e.g. runs/A1/R2_05_squareyards_run1.json."""
    return folder / system / f"{case_id}_run{run}.json"


def save(target: Path, record: BaseModel) -> None:
    """Write a record so that a half-written file can never look finished."""
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(record.model_dump_json(indent=2))
    # rename is atomic: the real name appears only once the file is complete,
    # even if the process is killed in the middle of a run.
    temporary.rename(target)
