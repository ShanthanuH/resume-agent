// Walks through the site in a real browser and checks that it behaves:
// the home page demo, the three-step form, a run, the result, the trace
// gesture, the keyboard, and the "runs are gone" screen. It needs no model
// and no backend, because it runs against a replay-mode build:
//
//   NEXT_PUBLIC_REPLAY=1 npm run build && NEXT_PUBLIC_REPLAY=1 npm run start -- -p 3100
//   npm run e2e
//
// It prints one line per check and exits with an error if any check fails.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESUME_PDF = join(WEB, "public/example.pdf"); // the made-up resume: never a real one
const JOB = "Backend engineer. You will build and run payment APIs in Python. ".repeat(6);

let failed = 0;
const problems = []; // console errors and crashes seen on any page

/** Run one named check and report it. A throw inside it is a failure. */
async function check(name, body) {
  try {
    await body();
    console.log(`ok    ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${name}\n      ${String(error.message ?? error).split("\n")[0]}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

// channel "chromium" uses the full browser that Playwright installed.
const browser = await chromium.launch({ channel: "chromium" });

/** A fresh window of the given width, with its console watched for errors. */
async function open(path, { width = 390, height = 844, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
  const page = await context.newPage();
  page.on("console", (message) => {
    // The 404 page is meant to answer 404: the browser's note about it is not a fault.
    if (message.type() === "error" && !message.text().includes("404")) problems.push(`${path}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${path}: ${error.message}`));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  return page;
}

const sideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const openPanels = (page) => page.locator('.reveal[data-open="true"]').count();

// --- The home page --------------------------------------------------------------

await check("home: the demo plays to the end and shows the original line by itself", async () => {
  const page = await open("/");
  await page.locator("mark").first().waitFor({ timeout: 12_000 }); // the highlights land
  await page.locator('.reveal[data-open="true"]').waitFor({ timeout: 4000 }); // then the original slides in
  expect((await page.locator("mark").count()) >= 2, "expected at least two highlights");
  expect((await sideScroll(page)) <= 0, "the page scrolls sideways at 390 px");
  await page.context().close();
});

await check("home: under 150 visible words, not counting the FAQ or the resume in the demo", async () => {
  const page = await open("/");
  await page.locator('.reveal[data-open="true"]').waitFor({ timeout: 16_000 });
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
  await page.locator('.reveal[data-open="true"]').waitFor({ timeout: 2000 });
  await page.getByText("Your original line").first().waitFor();
  await page.mouse.move(5, 5); // away from the resume
  await page.waitForFunction(() => document.querySelectorAll('.reveal[data-open="true"]').length === 0, null, { timeout: 2000 });
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
  const reachable = await page.evaluate(() => {
    const closed = document.querySelector('.reveal[data-open="false"]');
    return closed ? closed.inert === true : false;
  });
  expect(reachable, "a closed panel should be inert");
  await page.context().close();
});

await check("trace: keep my original changes the line, the count and the download", async () => {
  const page = await open("/states/done");
  await page.locator("article li button[aria-expanded]").first().click();
  await page.locator('.reveal[data-open="true"]').getByRole("button", { name: "Keep my original" }).click();
  await page.getByRole("heading", { level: 1, name: /^1 line changed/ }).waitFor();
  // The saved PDF no longer matches, so the download is now made on request.
  await page.getByRole("button", { name: "Download PDF" }).waitFor();
  await page.locator('.reveal[data-open="true"]').getByRole("button", { name: "Use the rewrite" }).click();
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

await check("no page logged an error", async () => {
  expect(problems.length === 0, problems.join(" | "));
});

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
