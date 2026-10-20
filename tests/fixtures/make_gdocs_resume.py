"""Build gdocs_resume.pdf, a fictional resume laid out like a Google Docs export.

Google Docs exports PDFs through Skia, the engine Chrome prints with, so this
writes the page as HTML and prints it with headless Chrome or Chromium.

What makes it Google Docs-like: Arial, a large Title and a grey Subtitle, headings
that are only bigger (regular weight, Title Case, no rule under them), "●" bullets
with a hanging indent, company and role on one line with the dates on a small
line below, blue underlined links.

    uv run python tests/fixtures/make_gdocs_resume.py [path/to/chrome]

The person and every detail are made up.
"""

import glob
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent

STYLE = """
@page { size: letter; margin: 0.7in 0.8in; }
body { font-family: Arial, "Liberation Sans", sans-serif; font-size: 10.5pt; line-height: 1.15; color: #000; margin: 0; }
p { margin: 0; }
.title { font-size: 26pt; }
.subtitle { font-size: 13pt; color: #666; margin-top: 2pt; }
.contact { font-size: 10pt; margin-top: 6pt; }
h2 { font-size: 14pt; font-weight: normal; color: #1f4e79; margin: 14pt 0 4pt; }
.role { margin-top: 6pt; }
.when { font-size: 8.5pt; color: #666; text-transform: uppercase; margin: 1pt 0 2pt; }
.row { display: flex; justify-content: space-between; margin-top: 6pt; }
.item { display: flex; margin-left: 18pt; }
.item .dot { width: 18pt; flex: none; }
a { color: #1155cc; text-decoration: underline; }
"""

BODY = """
<p class="title">Daniel Osei</p>
<p class="subtitle">Product Data Scientist</p>
<p class="contact">Pune, India · +91-90000-77777 · <a href="mailto:daniel.osei@example.com">daniel.osei@example.com</a> · <a href="https://github.com/daniel-osei-example">github.com/daniel-osei-example</a></p>

<h2>Summary</h2>
<p>Product data scientist who turns messy event data into decisions. Four years of experiments, metrics and dashboards for consumer apps. Happiest close to the product team.</p>

<h2>Experience</h2>
<p class="role"><b>Brightline Health</b>, Pune — <i>Senior Data Analyst</i></p>
<p class="when">Jan 2022 – Present</p>
<div class="item"><span class="dot">●</span><span>Designed and analysed 25 A/B tests on the booking flow, including one that raised completed bookings by 7% and is now the default flow for all users.</span></div>
<div class="item"><span class="dot">●</span><span>Built the weekly product metrics model in dbt and Looker, used by four product teams.</span></div>
<div class="item"><span class="dot">●</span><span>Taught a monthly SQL clinic for product managers.</span></div>
<p class="role"><b>Kitepost</b>, Remote — <i>Data Analyst</i></p>
<p class="when">Jun 2019 – Dec 2021</p>
<div class="item"><span class="dot">●</span><span>Tracked onboarding drop-off with funnel reports in SQL, which led to a shorter sign-up form.</span></div>
<div class="item"><span class="dot">●</span><span>Cleaned and documented the event schema of the mobile app.</span></div>

<h2>Things I've Built</h2>
<div class="row"><span><b>Tidewatch</b> – flood alerts from river gauge data (<a href="https://tidewatch.example.com">live</a>, <a href="https://github.com/daniel-osei-example/tidewatch">code</a>)</span><span>2024</span></div>
<div class="item"><span class="dot">●</span><span>Sends a text alert when a river gauge rises faster than its seasonal pattern.</span></div>
<div class="row"><span><b>Menu Mapper</b> – nutrition labels from menu photos (<a href="https://menumapper.example.org">live</a>)</span><span>2023</span></div>
<div class="item"><span class="dot">●</span><span>Reads menu photos with OCR and matches dishes to a nutrition table.</span></div>

<h2>Education</h2>
<p class="role"><b>University of Pune</b> — <i>B.Sc. Statistics</i></p>
<p class="when">2016 – 2019</p>

<h2>Skills &amp; Tools</h2>
<p>Python, SQL, dbt, Looker, A/B testing, causal inference, Git</p>
"""


def chrome() -> str:
    if len(sys.argv) > 1:
        return sys.argv[1]
    for name in ("google-chrome", "chromium", "chromium-browser"):
        if shutil.which(name):
            return name
    found = glob.glob(str(Path.home() / ".cache/ms-playwright/chromium-*/chrome-linux*/chrome"))
    if found:
        return found[0]
    sys.exit("No Chrome found. Pass its path as the first argument.")


html = HERE / "gdocs_resume.html"
html.write_text(f"<!doctype html><html><head><meta charset='utf-8'><style>{STYLE}</style></head><body>{BODY}</body></html>")
pdf = HERE / "gdocs_resume.pdf"
subprocess.run(
    [chrome(), "--headless", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
     f"--print-to-pdf={pdf}", html.as_uri()],
    check=True,
    capture_output=True,
)
print("wrote", html, "and", pdf)
