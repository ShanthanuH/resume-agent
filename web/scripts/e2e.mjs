// Walks through the site in a real browser and checks that it behaves:
// the home page demo, the three-step form, a run, the result, the trace
// gesture, the keyboard, and the "runs are gone" screen. It needs no model
// and no backend, because it runs against a replay-mode build:
//
//   NEXT_PUBLIC_REPLAY=1 npm run build && NEXT_PUBLIC_REPLAY=1 npm run start -- -p 3100
//   npm run e2e
//
// It prints one line per check and exits with an error if any check fails.
// Each skin has its own checks (calm first, then bold); SKIN=calm or
// SKIN=bold runs one only. The skin is chosen the way a visitor would: by
// cookie. The browser is the Google Chrome installed on this machine.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESUME_PDF = join(WEB, "public/example.pdf"); // the made-up resume: never a real one
const JOB = "Backend engineer. You will build and run payment APIs in Python. ".repeat(6);

const SKINS = process.env.SKIN ? [process.env.SKIN] : ["calm", "bold"];
let skin = SKINS[0]; // the skin the checks below are running on

let failed = 0;
const problems = []; // console errors and crashes seen on any page

/** Run one named check and report it. A throw inside it is a failure. */
async function check(name, body) {
  try {
    await body();
    console.log(`ok    [${skin}] ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  [${skin}] ${name}\n      ${String(error.message ?? error).split("\n")[0]}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

// channel "chrome" uses the Google Chrome installed on this machine.
const browser = await chromium.launch({ channel: "chrome" });

/** A fresh window of the given width, with its console watched for errors. */
async function open(path, { width = 390, height = 844, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
  // Calm is the default and needs no cookie; bold is chosen with one.
  if (skin === "bold") await context.addCookies([{ name: "design", value: skin, url: BASE }]);
  const page = await context.newPage();
  page.on("console", (message) => {
    // The 404 page is meant to answer 404: the browser's note about it is not a fault.
    if (message.type() === "error" && !message.text().includes("404")) problems.push(`[${skin}] ${path}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`[${skin}] ${path}: ${error.message}`));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  return page;
}

const sideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
// The panel under a changed line: ".reveal" in bold, ".unfold" in calm.
const PANEL = ":is(.reveal, .unfold)";
const OPEN_PANEL = `${PANEL}[data-open="true"]`;
const openPanels = (page) => page.locator(OPEN_PANEL).count();

// --- The calm skin ---------------------------------------------------------------

const JOB_LABEL = "The job post";
const SUBMIT = /recorded run|Tailor my resume/;

/** On the calm home page: add the made-up resume, paste a job post, press the button. */
async function startCalmRun(page) {
  await page.locator('input[type="file"]').setInputFiles(RESUME_PDF);
  await page.getByLabel(JOB_LABEL).fill(JOB);
  await page.locator("form").getByRole("button", { name: SUBMIT }).click();
  await page.getByRole("heading", { level: 1, name: "Matching your resume to the job" }).waitFor();
}

async function calmChecks() {
  await check("home: one h1, no sideways scroll, the example's first line open and the others toggle", async () => {
    const page = await open("/");
    expect((await page.locator("h1").count()) === 1, "the home page should have one h1");
    expect((await sideScroll(page)) <= 0, "the page scrolls sideways at 390 px");
    const toggles = page.locator("#how button[aria-expanded]");
    expect((await toggles.count()) === 2, "expected two changed lines in the example");
    expect((await toggles.nth(0).getAttribute("aria-expanded")) === "true", "the first changed line should start open");
    await toggles.nth(1).click();
    expect((await toggles.nth(1).getAttribute("aria-expanded")) === "true", "a tap should open the second line");
    await page.getByText("Before:").nth(1).waitFor();
    await page.context().close();
  });

  await check("home: the FAQ starts with the first answer open, and several can be open", async () => {
    const page = await open("/", { width: 1440, height: 900 });
    const first = page.getByRole("button", { name: "Is it actually free?" });
    const second = page.getByRole("button", { name: "Will it add skills I don't have?" });
    expect((await first.getAttribute("aria-expanded")) === "true", "the first answer should start open");
    await second.press("Enter"); // from the keyboard
    expect((await second.getAttribute("aria-expanded")) === "true", "Enter should open the second answer");
    expect((await first.getAttribute("aria-expanded")) === "true", "the first answer should stay open");
    await page.context().close();
  });

  await check("form: pressing the button with nothing in says what is missing, and focuses the drop area", async () => {
    const page = await open("/");
    await page.locator("form").getByRole("button", { name: SUBMIT }).click();
    expect((await page.locator("form").getByRole("alert").count()) === 2, "expected one message per empty field");
    await page.getByText("Add your resume first.").waitFor();
    const focused = await page
      .waitForFunction(() => document.activeElement?.id === "resume-drop", null, { timeout: 2000 })
      .then(() => true, () => false);
    expect(focused, "focus should be on the drop area");
    await page.context().close();
  });

  await check("form: a file over 2 MB is refused at once, a good PDF is accepted", async () => {
    const page = await open("/");
    await page.locator('input[type="file"]').setInputFiles({ name: "huge.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
    await page.getByText("That file is over 2 MB.").waitFor();
    await page.locator('input[type="file"]').setInputFiles(RESUME_PDF);
    await page.getByText("example.pdf").waitFor();
    expect((await page.locator("form").getByRole("alert").count()) === 0, "the problem should be gone");
    await page.context().close();
  });

  await check("flow: form, running card, result, with no page reload", async () => {
    const page = await open("/", { width: 1440, height: 900 });
    await page.evaluate(() => (window.__sameDocument = true)); // lost if the page ever reloads
    await startCalmRun(page);
    await page.getByText(/^Step \d of 5$/).waitFor();
    await page.getByRole("switch", { name: "Show steps" }).waitFor();
    await page.getByRole("button", { name: "Skip to the result" }).click();
    await page.getByRole("heading", { level: 1, name: "2 lines changed" }).waitFor();
    expect(await page.evaluate(() => window.__sameDocument === true), "the page reloaded during the flow");
    expect((await page.locator("article mark").count()) >= 2, "no highlighted words on the resume");
    const download = page.getByRole("link", { name: "Download PDF" });
    expect((await download.getAttribute("href")) === "/example.pdf", "the download should be the saved PDF");
    expect((await sideScroll(page)) <= 0, "the result scrolls sideways");
    await page.context().close();
  });

  await check("result: show changes off gives the clean text, keep my original changes the count and the download", async () => {
    const page = await open("/states/done", { width: 1440, height: 900 });
    await page.getByRole("switch", { name: "Show changes" }).click();
    expect((await page.locator("article mark").count()) === 0, "the clean page should have no marks");
    await page.getByRole("switch", { name: "Show changes" }).click();
    await page.getByRole("button", { name: "Keep my original" }).first().click();
    await page.getByRole("heading", { level: 1, name: "1 line changed" }).waitFor();
    await page.getByRole("button", { name: "Use the new version" }).waitFor();
    // The saved PDF no longer matches, so the download is now made on request.
    await page.getByRole("button", { name: "Download PDF" }).waitFor();
    await page.getByRole("button", { name: "Use the new version" }).click();
    await page.getByRole("heading", { level: 1, name: "2 lines changed" }).waitFor();
    await page.context().close();
  });

  await check("result: try another job post keeps the resume, empties the job post and focuses it", async () => {
    const page = await open("/", { width: 1440, height: 900 });
    await startCalmRun(page);
    await page.getByRole("button", { name: "Skip to the result" }).click();
    await page.getByRole("button", { name: "Try another job post" }).click();
    await page.getByText("example.pdf").waitFor();
    const job = page.getByLabel(JOB_LABEL);
    expect((await job.inputValue()) === "", "the job post should be empty");
    const focused = await page
      .waitForFunction(() => document.activeElement?.id === "job-post", null, { timeout: 2000 })
      .then(() => true, () => false);
    expect(focused, "focus should be on the job post");
    await page.context().close();
  });

  await check("example: the recorded run plays through the running and result screens, with its note", async () => {
    const page = await open("/example");
    await page.getByText("This is a recorded example.", { exact: false }).waitFor();
    await page.getByRole("heading", { level: 1, name: "Matching your resume to the job" }).waitFor();
    await page.getByRole("button", { name: "Skip to the result" }).click();
    await page.getByRole("heading", { level: 1, name: "2 lines changed" }).waitFor();
    await page.getByText("This is a recorded example.", { exact: false }).waitFor();
    await page.context().close();
  });

  await check("limited, paused and error each say what happened and offer a way on", async () => {
    const limited = await open("/states/limited");
    await limited.getByRole("heading", { name: "That's all for today." }).waitFor();
    await limited.getByRole("button", { name: "See the example" }).click();
    await limited.getByRole("heading", { level: 1, name: "Matching your resume to the job" }).waitFor();
    await limited.context().close();
    const paused = await open("/states/paused");
    await paused.getByRole("heading", { name: "Runs are paused for now." }).waitFor();
    await paused.context().close();
    const error = await open("/states/error");
    await error.getByRole("heading", { name: "That didn't work." }).waitFor();
    await error.getByRole("button", { name: "Try again" }).click();
    await error.getByText("meera-kulkarni-resume.pdf").waitFor(); // back at the form, file kept
    await error.context().close();
  });

  await check("reduced motion: nothing moves, the strikes show fully drawn", async () => {
    const page = await open("/", { width: 1440, height: 900, reducedMotion: "reduce" });
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll(".drift, .drift2, .strike-draw, .twinkle")].filter(
        (el) => getComputedStyle(el).animationName !== "none",
      ).length,
    );
    expect(moving === 0, `${moving} elements still animate`);
    await page.context().close();
  });

  await check("keyboard: Tab reaches the drop area, and Enter opens the file picker", async () => {
    const page = await open("/", { width: 1440, height: 900 });
    let found = false;
    for (let i = 0; i < 12 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate(() => document.activeElement?.id === "resume-drop");
    }
    expect(found, "the drop area should be reachable with Tab");
    const chooser = page.waitForEvent("filechooser", { timeout: 5000 });
    await page.keyboard.press("Enter");
    await chooser;
    await page.context().close();
  });

  await check("every page is free of sideways scroll at 390 px", async () => {
    for (const path of ["/", "/try", "/example", "/privacy", "/states/done", "/states/bad-file-scan", "/no-such-page"]) {
      const page = await open(path);
      await page.waitForTimeout(400);
      const extra = await sideScroll(page);
      expect(extra <= 0, `${path} is ${extra}px too wide`);
      await page.context().close();
    }
  });
}

// --- The bold skin ----------------------------------------------------------------

async function boldChecks() {
  // --- The home page --------------------------------------------------------------

  await check("home: the demo plays to the end and shows the original line by itself", async () => {
    const page = await open("/");
    await page.locator("figure").first().scrollIntoViewIfNeeded(); // the demo starts when it is seen
    await page.locator("mark").first().waitFor({ timeout: 12_000 }); // the highlights land
    await page.locator(OPEN_PANEL).waitFor({ timeout: 4000 }); // then the original slides in
    expect((await page.locator("mark").count()) >= 2, "expected at least two highlights");
    expect((await sideScroll(page)) <= 0, "the page scrolls sideways at 390 px");
    await page.context().close();
  });

  await check("home: under 150 visible words, not counting the FAQ or the resume in the demo", async () => {
    const page = await open("/");
    await page.locator("figure").first().scrollIntoViewIfNeeded();
    await page.locator(OPEN_PANEL).waitFor({ timeout: 16_000 });
    const count = await page.evaluate(() => {
      const words = (selector) => {
        const text = document.querySelector(selector)?.innerText ?? "";
        return text.trim().split(/\s+/).filter(Boolean).length;
      };
      // innerText only holds what is on show: closed toggles are left out by the browser.
      const all = words("body");
      const resume = words("figure article"); // the product itself, not words about it
      const faq = words('section[aria-labelledby="faq"]');
      return { resume, faq, copy: all - resume - faq };
    });
    console.log(`      ${count.copy} words of copy (plus ${count.faq} in the FAQ, ${count.resume} of example resume)`);
    expect(count.copy <= 150, `the home page shows ${count.copy} words of copy`);
    await page.context().close();
  });

  await check("home: with reduced motion the demo shows its end result at once", async () => {
    const page = await open("/", { reducedMotion: "reduce" });
    await page.locator("figure").first().scrollIntoViewIfNeeded();
    await page.locator("mark").first().waitFor({ timeout: 2500 }); // no 4-second wait
    await page.context().close();
  });

  // --- The form -------------------------------------------------------------------

  await check("flow: pressing the button with nothing in says what is missing, and moves focus there", async () => {
    const page = await open("/try");
    await page.getByRole("button", { name: /recorded run|Tailor my resume/ }).click();
    // Counted inside the form: Next.js keeps a hidden "alert" of its own in every page.
    expect((await page.locator("form").getByRole("alert").count()) === 2, "expected one message per empty field");
    // The page moves focus one animation frame after the click, so wait for it
    // (up to 2 s) instead of reading it at once.
    const focused = await page
      .waitForFunction(() => document.activeElement?.getAttribute("type") === "file", null, { timeout: 2000 })
      .then(() => true, () => false);
    expect(focused, "focus should be on the resume file input");
    await page.context().close();
  });

  await check("flow: a file over 2 MB is refused at once, a good PDF is accepted", async () => {
    const page = await open("/try");
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({ name: "huge.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
    await page.getByText("over 2 MB").waitFor();
    await page.locator('input[type="file"]').setInputFiles(RESUME_PDF);
    await page.getByText("example.pdf").waitFor();
    expect((await page.locator("form").getByRole("alert").count()) === 0, "the problem should be gone");
    await page.context().close();
  });

  // --- A run, the result and the trace ---------------------------------------------

  await check("flow: three steps, one button, a run, a result, with no page reload", async () => {
    const page = await open("/try", { width: 1440, height: 900 });
    await page.evaluate(() => (window.__sameDocument = true)); // lost if the page ever reloads
    await page.locator('input[type="file"]').setInputFiles(RESUME_PDF);
    await page.getByLabel("The job post").fill(JOB);
    await page.getByRole("button", { name: /recorded run|Tailor my resume/ }).click();

    // The wait: one sentence in a live region, one progress bar, a clock.
    const sentence = page.locator('h1[aria-live="polite"]');
    await sentence.waitFor();
    expect((await sentence.innerText()).length > 5, "no progress sentence");
    await page.getByRole("progressbar").waitFor();
    await page.getByRole("timer").waitFor();

    // The steps list holds plain sentences: no IDs, no JSON, no tool names.
    await page.getByRole("button", { name: "Show steps" }).click();
    await page.getByRole("button", { name: "Skip to the result" }).click();
    await page.getByRole("heading", { level: 1, name: /lines changed/ }).waitFor();
    expect(await page.evaluate(() => window.__sameDocument === true), "the page reloaded during the flow");

    // The result: resume with highlights, download button, what is missing.
    expect((await page.locator("article mark").count()) >= 2, "no highlighted words on the resume");
    const download = page.getByRole("link", { name: "Download PDF" });
    expect((await download.getAttribute("href")) === "/example.pdf", "the download should be the saved PDF");
    await page.getByText("Not on your resume").waitFor();
    expect((await sideScroll(page)) <= 0, "the result scrolls sideways");
    await page.context().close();
  });

  await check("trace: pointing at a changed line slides its original in, and moving away slides it out", async () => {
    const page = await open("/states/done", { width: 1440, height: 900 });
    const line = page.locator("article li button[aria-expanded]").first();
    await line.hover();
    await page.locator(OPEN_PANEL).waitFor({ timeout: 2000 });
    await page.getByText("Your original line").first().waitFor();
    await page.mouse.move(5, 5); // away from the resume
    await page.waitForFunction((open) => document.querySelectorAll(open).length === 0, OPEN_PANEL, { timeout: 2000 });
    await page.context().close();
  });

  await check("trace: a tap pins it open, and the keyboard works too", async () => {
    const page = await open("/states/done");
    const line = page.locator("article li button[aria-expanded]").first();
    await line.click();
    expect((await line.getAttribute("aria-expanded")) === "true", "a tap should open the line");
    expect((await openPanels(page)) === 1, "one panel should be open");
    await line.press("Enter"); // the same button, from the keyboard
    expect((await line.getAttribute("aria-expanded")) === "false", "Enter should close it again");
    // A closed panel must be out of reach of the Tab key.
    const reachable = await page.evaluate((panel) => {
      const closed = document.querySelector(`${panel}[data-open="false"]`);
      return closed ? closed.inert === true : false;
    }, PANEL);
    expect(reachable, "a closed panel should be inert");
    await page.context().close();
  });

  await check("trace: keep my original changes the line, the count and the download", async () => {
    const page = await open("/states/done");
    await page.locator("article li button[aria-expanded]").first().click();
    await page.locator(OPEN_PANEL).getByRole("button", { name: "Keep my original" }).click();
    await page.getByRole("heading", { level: 1, name: /^1 line changed/ }).waitFor();
    // The saved PDF no longer matches, so the download is now made on request.
    await page.getByRole("button", { name: "Download PDF" }).waitFor();
    await page.locator(OPEN_PANEL).getByRole("button", { name: "Use the rewrite" }).click();
    await page.getByRole("heading", { level: 1, name: /^2 lines changed/ }).waitFor();
    await page.context().close();
  });

  // --- The recorded run, and when live runs cannot start ----------------------------

  await check("example: the recorded run starts by itself, is labelled, and can be skipped", async () => {
    const page = await open("/example");
    await page.getByText("Recorded run", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Skip to the result" }).click();
    await page.getByRole("heading", { level: 1, name: /lines changed/ }).waitFor();
    await page.getByText("Recorded run", { exact: true }).waitFor(); // still labelled on the result
    await page.context().close();
  });

  await check("limited: the day's runs are gone, and the recorded run is one press away", async () => {
    const page = await open("/states/limited");
    await page.getByRole("heading", { level: 1, name: "Today's free runs are gone." }).waitFor();
    await page.getByRole("button", { name: "Watch a real run" }).click();
    await page.locator('h1[aria-live="polite"]').waitFor();
    await page.getByText("Recorded run", { exact: true }).waitFor();
    await page.context().close();
  });

  await check("paused and error each say what happened and offer a way on", async () => {
    const paused = await open("/states/paused");
    await paused.getByRole("heading", { level: 1, name: "The live demo is paused." }).waitFor();
    await paused.getByRole("button", { name: "Watch a real run" }).waitFor();
    await paused.context().close();
    const error = await open("/states/error");
    await error.getByRole("heading", { level: 1, name: "That did not work." }).waitFor();
    await error.getByRole("button", { name: "Try again" }).click();
    await error.getByRole("heading", { level: 1, name: "Tailor your resume" }).waitFor(); // back at the form
    await error.context().close();
  });

  await check("every page is free of sideways scroll at 390 px", async () => {
    for (const path of ["/", "/try", "/example", "/privacy", "/states/done", "/states/bad-file-scan", "/no-such-page"]) {
      const page = await open(path);
      await page.waitForTimeout(400);
      const extra = await sideScroll(page);
      expect(extra <= 0, `${path} is ${extra}px too wide`);
      await page.context().close();
    }
  });
}

for (skin of SKINS) {
  if (skin === "calm") await calmChecks();
  else await boldChecks();
}

// --- The switch between skins ----------------------------------------------------

await check("?design= picks the skin, and a cookie remembers it", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Each skin loads its own stylesheet and typeface: Jost for bold, Manrope for calm.
  const font = () => page.evaluate(() => getComputedStyle(document.body).fontFamily);
  const cookie = async () => (await context.cookies()).find((c) => c.name === "design");
  await page.goto(`${BASE}/`);
  expect(/manrope/i.test(await font()), "calm should be the default");
  await page.goto(`${BASE}/?design=bold`);
  expect(/jost/i.test(await font()), "?design=bold should serve the bold skin");
  const kept = await cookie();
  expect(kept && kept.expires - Date.now() / 1000 > 360 * 24 * 3600, "the bold choice should be kept for a year");
  await page.goto(`${BASE}/privacy`); // no ?design= this time: the cookie holds it
  expect(/jost/i.test(await font()), "the bold choice should be remembered on the next page");
  await page.goto(`${BASE}/?design=calm`);
  expect(/manrope/i.test(await font()), "?design=calm should serve the calm skin");
  expect(!(await cookie()), "?design=calm should delete the cookie");
  await context.close();
});

await check("no page logged an error", async () => {
  expect(problems.length === 0, problems.join(" | "));
});

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
