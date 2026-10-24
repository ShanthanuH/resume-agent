"""Build a phone page for labelling sheet.csv. Run: uv run python -m eval.phone_sheet

Reads only eval/labels/sheet.csv and the resumes. It never opens key.csv, so
the page cannot hold a system name, case ID or judge verdict.

Writes ~/label-sheet.html (outside the repo). Read the exported labels back
with: uv run python -m eval.import_labels labels.json
"""

import csv
import json
import re
from pathlib import Path

from eval.data import load_resume
from eval.sheet import LABELS

OUT = Path.home() / "label-sheet.html"
SOURCES = 3  # how many closest resume lines to show under each new line

# Words that match almost any line, so they say nothing about support.
_STOP = set(
    "a an and the of to in on for with by from at as is are was were be been "
    "using used use via into over across that this which their its it or".split()
)


def words(text: str) -> set[str]:
    """Content words: lower case, letters/digits plus . % + kept inside a token."""
    # "1.5%", "C++" and "15,000+" stay one token each; a comma between digits is dropped.
    tokens = re.findall(r"[a-z0-9][a-z0-9.%+#]*", text.lower().replace(",", ""))
    return {t.rstrip(".") for t in tokens if t.rstrip(".") not in _STOP}


def closest(line: str, resume_lines: list[str]) -> list[int]:
    """Indexes of the resume lines sharing the most content words with line."""
    target = words(line)
    scored = [(len(target & words(r)), i) for i, r in enumerate(resume_lines)]
    # Highest overlap first; ties go to the earlier line. Lines sharing nothing are left out.
    best = sorted((s for s in scored if s[0] > 0), key=lambda s: (-s[0], s[1]))
    return [i for _, i in best[:SOURCES]]


PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Label sheet</title>
<style>
 :root{--bg:#fff;--fg:#111;--mut:#666;--line:#ddd;--card:#f5f5f5;--mark:#ffe46b;--acc:#0a66c2}
 @media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--mut:#999;--line:#333;--card:#1c1c1c;--mark:#6b5a00;--acc:#5aa2ff}}
 *{box-sizing:border-box} html,body{margin:0;background:var(--bg);color:var(--fg)}
 body{font:16px/1.45 system-ui,sans-serif;padding:12px 16px 190px}
 #top{display:flex;gap:8px;align-items:center;font-size:14px;color:var(--mut)}
 #bar{flex:1;height:8px;background:var(--line);border-radius:4px;overflow:hidden}
 #fill{height:100%;background:var(--acc);width:0}
 #line{font-size:22px;line-height:1.35;margin:14px 0;font-weight:600;overflow-wrap:anywhere}
 #mine{font-size:14px;color:var(--mut);min-height:1.2em}
 h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin:18px 0 6px}
 .src{background:var(--card);border-radius:8px;padding:10px;margin:6px 0;overflow-wrap:anywhere}
 mark{background:var(--mark);color:inherit;border-radius:2px}
 details{margin-top:18px} summary{font-weight:600;padding:8px 0}
 #resume{white-space:pre-wrap;font-size:13px;overflow-wrap:anywhere}
 #nag{display:none;background:var(--mark);padding:10px;border-radius:8px;margin:10px 0}
 #tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px} #tools button{flex:1;min-width:30%}
 button{font:inherit;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg)}
 #dock{position:fixed;left:0;right:0;bottom:0;background:var(--bg);border-top:1px solid var(--line);
  padding:10px 16px calc(10px + env(safe-area-inset-bottom))}
 #big{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
 #big button{font-size:18px;font-weight:700;padding:20px 4px;color:#fff;border:0}
 #yes{background:#1b7f3b} #no{background:#b3261e} #unsure{background:#6b6b6b}
 #big button.on{outline:4px solid var(--fg);outline-offset:2px}
 #nav{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px}
</style></head><body>
<div id="top"><span id="id"></span><div id="bar"><div id="fill"></div></div><span id="count"></span></div>
<div id="nag">You have __EVERY__ more labels since the last export. <button id="nagx">Export now</button></div>
<div id="line"></div>
<div id="mine"></div>
<h2>Closest lines in the original resume</h2>
<div id="srcs"></div>
<details id="full"><summary>Full original resume</summary><div id="resume"></div></details>
<div id="tools">
 <button id="exp">Export</button><button id="imp">Import</button>
 <input id="file" type="file" accept="application/json,.json" hidden>
</div>
<p id="msg" style="color:var(--mut);font-size:14px"></p>
<div id="dock">
 <div id="big"><button id="yes">Supported</button><button id="no">Unsupported</button><button id="unsure">Unsure</button></div>
 <div id="nav"><button id="back">&larr; Back</button><button id="skip">Next &rarr;</button><button id="jump">Next unlabelled</button></div>
</div>
<script>
// rows: {id, line, r: resume index, s: indexes of its closest resume lines}
const rows = __ROWS__, resumes = __RESUMES__;
const KEY = "label-sheet-v1", EVERY = __EVERY__;
const $ = id => document.getElementById(id);
// Storage can be blocked (private mode); the page still works, it just forgets on reload.
function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }
// labels: id -> "supported" | "unsupported" | "unsure". sinceExport counts new taps.
const st = Object.assign({labels: {}, at: 0, sinceExport: 0}, load(KEY, {}));
const NAMES = {supported: "Supported", unsupported: "Unsupported", unsure: "Unsure"};

function words(t) {  // same tokens as the Python builder, so highlights match its ranking
  const stop = new Set(__STOP__);
  return new Set((t.toLowerCase().replaceAll(",", "").match(/[a-z0-9][a-z0-9.%+#]*/g) || [])
    .map(w => w.replace(/\\.+$/, "")).filter(w => !stop.has(w)));
}
// Wrap the shared words of text in <mark>. Built from text nodes, never innerHTML,
// so resume text cannot inject markup.
function highlighted(text, target) {
  const box = document.createElement("div"); box.className = "src";
  for (const part of text.split(/([A-Za-z0-9][A-Za-z0-9.,%+#]*)/)) {
    const hit = /^[A-Za-z0-9]/.test(part) && [...words(part)].some(w => target.has(w));
    const node = hit ? document.createElement("mark") : document.createTextNode(part);
    if (hit) node.textContent = part;
    box.append(node);
  }
  return box;
}

function show() {
  const r = rows[st.at], target = words(r.line), mine = st.labels[r.id];
  const n = Object.keys(st.labels).length;
  $("id").textContent = r.id;
  $("count").textContent = n + "/" + rows.length;
  $("fill").style.width = (100 * n / rows.length) + "%";
  $("line").textContent = r.line;
  $("mine").textContent = mine ? "Your label: " + NAMES[mine] : "Not labelled";
  for (const [b, v] of [["yes", "supported"], ["no", "unsupported"], ["unsure", "unsure"]])
    $(b).classList.toggle("on", mine === v);
  $("srcs").replaceChildren(...(r.s.length ? r.s.map(i => highlighted(resumes[r.r][i], target))
    : [Object.assign(document.createElement("div"), {className: "src", textContent: "No resume line shares a word."})]));
  $("resume").textContent = resumes[r.r].join("\\n");
  $("nag").style.display = st.sinceExport >= EVERY ? "block" : "none";
  window.scrollTo(0, 0);
}
function go(i) { st.at = Math.max(0, Math.min(rows.length - 1, i)); save(); show(); }
function mark(v) {
  const id = rows[st.at].id;
  if (st.labels[id] !== v) st.sinceExport++;  // a re-tap of the same label is not new work
  st.labels[id] = v; save();
  st.at < rows.length - 1 ? go(st.at + 1) : show();
}
function nextOpen() {  // first unlabelled row after this one, wrapping round
  for (let k = 1; k <= rows.length; k++) {
    const i = (st.at + k) % rows.length;
    if (!st.labels[rows[i].id]) return go(i);
  }
  $("msg").textContent = "All " + rows.length + " rows are labelled. Export them.";
}
function exportLabels() {
  const text = JSON.stringify({exported: new Date().toISOString(), labels: st.labels}, null, 1);
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([text], {type: "application/json"})),
    download: "labels-" + Object.keys(st.labels).length + ".json"});
  document.body.append(a); a.click(); a.remove();
  // Clipboard API needs a secure context; fall back to the old copy command.
  const fallback = () => { const t = Object.assign(document.createElement("textarea"), {value: text});
    document.body.append(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); };
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).catch(fallback);
  st.sinceExport = 0; save(); show();
  $("msg").textContent = "Exported " + Object.keys(st.labels).length + " labels (file + clipboard).";
}
$("file").onchange = async e => {
  try {
    const got = JSON.parse(await e.target.files[0].text()).labels || {};
    const known = new Set(rows.map(r => r.id));
    // Keep only real row IDs with a real label value; count what was dropped.
    const ok = Object.entries(got).filter(([id, v]) => known.has(id) && v in NAMES);
    ok.forEach(([id, v]) => st.labels[id] = v); save(); show();
    $("msg").textContent = "Imported " + ok.length + " labels" +
      (ok.length < Object.keys(got).length ? ", skipped " + (Object.keys(got).length - ok.length) + " bad ones." : ".");
  } catch (err) { $("msg").textContent = "Import failed: " + err.message; }
  e.target.value = "";  // so the same file can be chosen again
};
$("yes").onclick = () => mark("supported"); $("no").onclick = () => mark("unsupported");
$("unsure").onclick = () => mark("unsure");
$("back").onclick = () => go(st.at - 1); $("skip").onclick = () => go(st.at + 1);
$("jump").onclick = nextOpen;
$("exp").onclick = exportLabels; $("nagx").onclick = exportLabels;
$("imp").onclick = () => $("file").click();
show();
</script></body></html>"""


def main() -> None:
    with (LABELS / "sheet.csv").open(newline="") as file:
        sheet = list(csv.DictReader(file))
    # Resumes are numbered in the order first seen, so even the resume ID stays out of the page.
    order = list(dict.fromkeys(row["resume_id"] for row in sheet))
    # The page shows the resume one line per row, blank lines dropped.
    resumes = [[l.strip() for l in load_resume(r).text.splitlines() if l.strip()] for r in order]
    rows = [
        {
            "id": row["row_id"],
            "line": row["line"],
            "r": order.index(row["resume_id"]),
            "s": closest(row["line"], resumes[order.index(row["resume_id"])]),
        }
        for row in sheet
    ]
    # "</" is escaped so that resume text can never close the script tag early.
    as_js = lambda value: json.dumps(value).replace("</", "<\\/")  # noqa: E731
    page = (
        PAGE.replace("__ROWS__", as_js(rows))
        .replace("__RESUMES__", as_js(resumes))
        .replace("__STOP__", as_js(sorted(_STOP)))
        .replace("__EVERY__", "25")
    )
    OUT.write_text(page)
    print(f"{len(rows)} rows -> {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
