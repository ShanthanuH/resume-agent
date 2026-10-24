"""Write labels exported from ~/label-sheet.html into sheet.csv.

Run: uv run python -m eval.import_labels labels.json [--sheet path/to/sheet.csv]

Supported -> Y, Unsupported -> N, Unsure -> ?. report.py counts only Y and N,
so an unsure row is left out of the agreement numbers. Stops without writing
if any ID in the JSON is not in the sheet.
"""

import argparse
import csv
import json
from pathlib import Path

from eval.sheet import LABELS

COLUMN = "supported (Y/N)"
CODES = {"supported": "Y", "unsupported": "N", "unsure": "?"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("labels", type=Path)
    parser.add_argument("--sheet", type=Path, default=LABELS / "sheet.csv")
    args = parser.parse_args()

    labels: dict[str, str] = json.loads(args.labels.read_text())["labels"]
    with args.sheet.open(newline="") as file:
        reader = csv.DictReader(file)
        fields, rows = reader.fieldnames, list(reader)

    sheet_ids = {row["row_id"] for row in rows}
    unknown = sorted(set(labels) - sheet_ids)  # in the JSON but not the sheet: wrong file
    bad = sorted(i for i, v in labels.items() if v not in CODES)
    if unknown or bad:
        raise SystemExit(f"Not written. Unknown IDs: {unknown or 'none'}. Bad values: {bad or 'none'}.")

    for row in rows:
        if row["row_id"] in labels:
            row[COLUMN] = CODES[labels[row["row_id"]]]
    # newline="" lets the csv module write its own line endings.
    with args.sheet.open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    missing = len(sheet_ids - set(labels))  # not labelled yet; fine mid-way
    counts = {code: sum(row[COLUMN] == code for row in rows) for code in CODES.values()}
    print(f"IDs match. Wrote {len(labels)} labels to {args.sheet}: {counts}, {missing} still blank.")


if __name__ == "__main__":
    main()
