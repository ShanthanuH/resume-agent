"""Build the human-labelling sheet. Run: uv run python -m eval.sheet

Writes three files to eval/labels/ (gitignored, they hold resume text):
- sheet.csv   200 shuffled rows to label. No system names.
- key.csv     row_id -> system, case and unit. Do not open it before labelling.
- label.html  the same rows with the original resume beside each one. Label
              there and press "Download sheet.csv", or fill sheet.csv by hand.
"""

import csv
import json
import random

from eval import config
from eval.data import load_cases, load_resume
from eval.score import ScoreRecord

ROWS = 200
SEED = 4  # fixed, so the same scores always give the same sheet
LABELS = config.ROOT / "labels"


def sample_rows() -> list[dict]:
    """Pick ROWS scored units from the real JDs, spread over systems and resumes."""
    cases = {c.id: c for c in load_cases()}
    # One pile of units per (system, resume) cell.
    cells: dict[tuple[str, str], list[dict]] = {}
    for system in config.SYSTEMS:
        for path in sorted((config.SCORES_DIR / system).glob("*.json")):
            score = ScoreRecord.model_validate_json(path.read_text())
            case = cases[score.case_id]
            if case.kind != "real":
                continue
            for index, unit_score in enumerate(score.units):
                cells.setdefault((system, case.resume_id), []).append(
                    {
                        "system": system,
                        "case_id": case.id,
                        "resume_id": case.resume_id,
                        "unit": index,  # position in the score file, to find the judge's verdict
                        "kind": unit_score.unit.kind,
                        "line": unit_score.unit.text,
                    }
                )
    rng = random.Random(SEED)
    for pile in cells.values():
        rng.shuffle(pile)
    # Deal one row from each cell in turn until there are ROWS. A small cell
    # (the careful prompt changes few lines) simply runs out and the others
    # keep going, so every cell gets as equal a share as it can fill.
    picked: list[dict] = []
    while len(picked) < ROWS and any(cells.values()):
        for key in sorted(cells):
            if cells[key] and len(picked) < ROWS:
                picked.append(cells[key].pop())
    rng.shuffle(picked)  # so the order says nothing about the system
    for number, row in enumerate(picked, start=1):
        row["row_id"] = f"L{number:03d}"
    return picked


def _shown(row: dict) -> str:
    """The text the labeller sees. A skill or header part is marked as such."""
    return row["line"] if row["kind"] == "line" else f"[{row['kind']}] {row['line']}"


PAGE = """<!doctype html><meta charset="utf-8"><title>Label sheet</title>
<style>
 body{font:15px/1.45 system-ui,sans-serif;margin:0;display:grid;grid-template-columns:1fr 1fr;height:100vh}
 #resume{white-space:pre-wrap;font:12px/1.4 monospace;overflow:auto;padding:16px;border-right:1px solid #999}
 #work{overflow:auto;padding:24px} #line{font-size:18px;margin:16px 0;padding:12px;border:1px solid #999}
 button{font-size:16px;padding:8px 18px;margin-right:8px} .on{outline:3px solid #06c}
 input{width:100%;font-size:15px;padding:6px;margin:4px 0 12px}
</style>
<pre id="resume"></pre>
<div id="work">
 <div><b id="where"></b> &nbsp; <span id="count"></span></div>
 <div id="line"></div>
 <p>Supported = every claim is stated in the original resume or is a plain rewording of it.<br>
 Unsupported = it adds a fact, makes a fact stronger, or changes a number.</p>
 <button id="Y">Y supported</button><button id="N">N unsupported</button>
 <p>Unsupported claim (optional)<input id="claim">Note (optional)<input id="note"></p>
 <button id="prev">&larr; Back</button><button id="next">Next &rarr;</button>
 <button id="save">Download sheet.csv</button>
 <p>Keys: Y, N, arrow keys. Labels are kept in this browser until you download.</p>
</div>
<script>
const rows = __ROWS__, resumes = __RESUMES__;
const done = JSON.parse(localStorage.getItem("labels") || "{}");
let at = Math.max(0, rows.findIndex(r => !(done[r.row_id] || {}).supported));
const $ = id => document.getElementById(id);
function keep() {
  const d = done[rows[at].row_id] ||= {};
  d.claim = $("claim").value; d.note = $("note").value;
  localStorage.setItem("labels", JSON.stringify(done));
}
function show() {
  const r = rows[at], d = done[r.row_id] || {};
  $("resume").textContent = resumes[r.resume_id];
  $("where").textContent = r.row_id + " of " + rows.length + " (" + r.resume_id + ")";
  $("count").textContent = Object.values(done).filter(d => d.supported).length + " labelled";
  $("line").textContent = r.line; $("claim").value = d.claim || ""; $("note").value = d.note || "";
  $("Y").className = d.supported == "Y" ? "on" : ""; $("N").className = d.supported == "N" ? "on" : "";
}
function mark(v) { keep(); done[rows[at].row_id].supported = v; keep(); move(1); }
function move(step) { keep(); at = Math.min(rows.length - 1, Math.max(0, at + step)); show(); }
$("Y").onclick = () => mark("Y"); $("N").onclick = () => mark("N");
$("prev").onclick = () => move(-1); $("next").onclick = () => move(1);
document.onkeydown = e => {
  if (e.target.tagName == "INPUT") return;
  if (e.key == "y" || e.key == "Y") mark("Y"); if (e.key == "n" || e.key == "N") mark("N");
  if (e.key == "ArrowLeft") move(-1); if (e.key == "ArrowRight") move(1);
};
$("save").onclick = () => {
  keep();
  const q = s => '"' + String(s || "").replaceAll('"', '""') + '"';
  const out = ["row_id,resume_id,line,supported (Y/N),claim,note"].concat(rows.map(r => {
    const d = done[r.row_id] || {};
    return [r.row_id, r.resume_id, q(r.line), d.supported || "", q(d.claim), q(d.note)].join(",");
  }));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out.join("\\n")], {type: "text/csv"}));
  a.download = "sheet.csv"; a.click();
};
show();
</script>"""


def main() -> None:
    rows = sample_rows()
    LABELS.mkdir(exist_ok=True)
    # newline="" lets the csv module write its own line endings.
    with (LABELS / "sheet.csv").open("w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["row_id", "resume_id", "line", "supported (Y/N)", "claim", "note"])
        for row in rows:
            writer.writerow([row["row_id"], row["resume_id"], _shown(row), "", "", ""])
    with (LABELS / "key.csv").open("w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["row_id", "system", "case_id", "unit", "kind"])
        for row in rows:
            writer.writerow([row["row_id"], row["system"], row["case_id"], row["unit"], row["kind"]])
    page_rows = [{"row_id": r["row_id"], "resume_id": r["resume_id"], "line": _shown(r)} for r in rows]
    resumes = {r: load_resume(r).text for r in sorted({row["resume_id"] for row in rows})}
    # "</" is escaped so that resume text can never close the script tag early.
    as_js = lambda value: json.dumps(value).replace("</", "<\\/")  # noqa: E731
    page = PAGE.replace("__ROWS__", as_js(page_rows)).replace("__RESUMES__", as_js(resumes))
    (LABELS / "label.html").write_text(page)

    print(f"{len(rows)} rows written to {LABELS}")
    for system in config.SYSTEMS:  # for me, not for the labeller
        per_resume = {r: sum(x["system"] == system and x["resume_id"] == r for x in rows) for r in resumes}
        print(f"  {system}: {per_resume}")


if __name__ == "__main__":
    main()
