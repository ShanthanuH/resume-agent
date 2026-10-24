// Takes a screenshot of every state of the site at phone and desktop width,
// and saves them in docs/screens/. Used to check the design by eye.
//
//   1. Build and start the site in replay mode (no model, no bot check):
//        NEXT_PUBLIC_REPLAY=1 npm run build && NEXT_PUBLIC_REPLAY=1 npm run start -- -p 3100
//   2. In another terminal:
//        node scripts/screens.mjs              every shot
//        node scripts/screens.mjs home done    only shots whose name has "home" or "done"
//
// BASE_URL picks another address (default http://localhost:3100). Every shot
// is taken for both skins, into docs/screens/calm and docs/screens/bold;
// SKIN=calm or SKIN=bold takes one only.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../docs/screens");
const WIDTHS = { 390: 844, 1440: 900 }; // width -> height of the window
const only = process.argv.slice(2);
const SKINS = process.env.SKIN ? [process.env.SKIN] : ["calm", "bold"];

/** Scroll the home page demo into view (it starts there), wait for its highlights, then come back up. */
async function playDemo(page) {
  await page.locator("figure").first().scrollIntoViewIfNeeded();
  await page.waitForSelector("mark", { timeout: 15000 });
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Wait until the fonts are in and the entrance animations have finished. */
async function settle(page, ms = 700) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

// Each shot: a name, the page to open, and what to do before the picture.
// `full` takes the whole page instead of the first screen.
const CALM_SHOTS = [
  { name: "home", path: "/", full: true },
  { name: "home-top", path: "/" },
  { name: "flow-missing", path: "/", act: (page) => page.locator("form").getByRole("button", { name: /recorded run|Tailor my resume/ }).click() },
  { name: "flow-paste", path: "/", act: (page) => page.getByRole("button", { name: "Or paste it as text" }).click() },
  { name: "flow-file-added", path: "/states/file-added" },
  { name: "flow-bad-file-scan", path: "/states/bad-file-scan" },
  { name: "flow-bad-file-big", path: "/states/bad-file-big" },
  { name: "try", path: "/try" },
  { name: "running-steps", path: "/states/running-fast", act: (page) => page.waitForTimeout(3000) },
  { name: "running-steps-off", path: "/states/running-fast", act: async (page) => {
      await page.getByRole("switch", { name: "Show steps" }).click();
      await page.waitForTimeout(3000);
    } },
  { name: "example", path: "/example", act: (page) => page.waitForTimeout(1500) },
  { name: "done", path: "/states/done", full: true },
  { name: "done-top", path: "/states/done" },
  { name: "done-clean", path: "/states/done", act: (page) => page.getByRole("switch", { name: "Show changes" }).click() },
  { name: "done-kept-original", path: "/states/done", act: (page) => page.getByRole("button", { name: "Keep my original" }).first().click() },
  { name: "done-question", path: "/states/done-question", full: true },
  { name: "error", path: "/states/error" },
  { name: "limited", path: "/states/limited" },
  { name: "limited-visitor", path: "/states/limited-visitor" },
  { name: "paused", path: "/states/paused" },
  { name: "privacy", path: "/privacy", full: true },
  { name: "not-found", path: "/no-such-page" },
  { name: "states", path: "/states", full: true },
];

const BOLD_SHOTS = [
  { name: "home", path: "/", full: true, act: playDemo },
  { name: "home-top", path: "/", act: playDemo },
  { name: "home-start", path: "/", act: (page) => page.waitForTimeout(350) }, // the demo just after it begins
  { name: "home-faq-open", path: "/", full: true, act: async (page) => {
      for (const summary of await page.locator("details > summary").all()) await summary.click();
      await settle(page, 2500);
    } },
  { name: "flow-empty", path: "/try" },
  { name: "flow-missing", path: "/try", act: async (page) => {
      await page.getByRole("button", { name: /recorded run|Tailor my resume/ }).click(); // pressed with nothing in
    } },
  { name: "flow-paste", path: "/try", act: (page) => page.getByRole("button", { name: "Paste text instead" }).click() },
  { name: "flow-file-added", path: "/states/file-added" },
  { name: "flow-bad-file-scan", path: "/states/bad-file-scan" },
  { name: "flow-bad-file-big", path: "/states/bad-file-big" },
  { name: "running-start", path: "/example", act: (page) => page.waitForTimeout(1500) },
  { name: "running-steps", path: "/states/running-fast", act: async (page) => {
      await page.getByRole("button", { name: "Show steps" }).click();
      await page.waitForTimeout(4200); // 8x faster: about half a minute into the run
    } },
  { name: "done", path: "/states/done", full: true },
  { name: "done-top", path: "/states/done" },
  { name: "done-trace-open", path: "/states/done", act: async (page) => {
      await page.locator("li button[aria-expanded]").first().click(); // the signature gesture
    } },
  { name: "done-kept-original", path: "/states/done", act: async (page) => {
      await page.locator("li button[aria-expanded]").first().click();
      // Only the open panel's button: the closed panels hold one each too.
      await page.locator(':is(.reveal, .unfold)[data-open="true"]').getByRole("button", { name: "Keep my original" }).click();
    } },
  { name: "done-question", path: "/states/done-question", full: true },
  { name: "done-steps", path: "/states/done", full: true, act: (page) => page.getByRole("button", { name: "Show steps" }).click() },
  { name: "error", path: "/states/error" },
  { name: "limited", path: "/states/limited" },
  { name: "limited-visitor", path: "/states/limited-visitor" },
  { name: "paused", path: "/states/paused" },
  { name: "privacy", path: "/privacy", full: true },
  { name: "not-found", path: "/no-such-page" },
  { name: "states", path: "/states", full: true },
];

// channel "chrome" uses the Google Chrome installed on this machine.
const browser = await chromium.launch({ channel: "chrome" });
for (const skin of SKINS) {
const dir = join(OUT, skin);
mkdirSync(dir, { recursive: true });
for (const shot of skin === "calm" ? CALM_SHOTS : BOLD_SHOTS) {
  if (only.length && !only.some((word) => shot.name.includes(word))) continue;
  for (const [width, height] of Object.entries(WIDTHS)) {
    const context = await browser.newContext({
      viewport: { width: Number(width), height },
      deviceScaleFactor: 1,
    });
    await context.addCookies([{ name: "design", value: skin, url: BASE }]);
    const page = await context.newPage();
    // Report anything the page complains about: a screenshot can look fine
    // while the console is full of errors.
    page.on("console", (message) => {
      if (message.type() === "error") console.log(`  console error on ${shot.name}: ${message.text()}`);
    });
    page.on("pageerror", (error) => console.log(`  page error on ${shot.name}: ${error.message}`));
    await page.goto(BASE + shot.path, { waitUntil: "networkidle" });
    await settle(page);
    if (shot.act) await shot.act(page);
    await settle(page);
    // No sideways scroll, on any screen: the page must not be wider than the window.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) console.log(`  SIDEWAYS SCROLL on ${shot.name} at ${width}: ${overflow}px too wide`);
    if (shot.full) {
      // A whole-page picture is stitched from several screens. Anything that
      // sticks to the window (the download bar on a phone) would be painted in
      // the middle of it, so for these shots it is put back in the page's flow.
      await page.addStyleTag({ content: ".sticky { position: static !important; } .arrive { animation: none !important; }" });
    }
    await page.screenshot({ path: join(dir, `${shot.name}-${width}.png`), fullPage: Boolean(shot.full) });
    await context.close();
  }
  console.log(`${skin} ${shot.name}`);
}
}
await browser.close();
