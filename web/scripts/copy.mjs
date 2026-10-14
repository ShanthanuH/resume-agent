// Every word a visitor can read lives in content/copy.yaml. This script checks
// that file and turns it into lib/copy.gen.ts, which the pages import.
//
//   node scripts/copy.mjs          check, then write lib/copy.gen.ts
//   node scripts/copy.mjs --check  check only (used by the tests)
//
// It runs before every dev server, build, lint and test (see package.json and
// next.config.ts). When something is wrong it stops with one plain line per
// problem, for example:
//
//   copy.yaml: hero_title is 61 characters, max is 50

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const WEB = join(dirname(fileURLToPath(import.meta.url)), ".."); // the web/ folder
const SOURCE = join(WEB, "content/copy.yaml");
const TARGET = join(WEB, "lib/copy.gen.ts");
const CODE_FOLDERS = ["app", "components", "lib", "skins"]; // where pages and components live

// Banned words, because they are the sound of a template.
export const BANNED = ["unlock", "supercharge", "seamless", "elevate", "effortless", "powerful", "leverage"];

// Pages with a word limit. `counts` picks the keys a visitor sees without
// opening anything; keys behind a toggle (home_more_*) and the FAQ (faq_*) are
// left out because their names do not match.
export const BUDGETS = [
  {
    name: "the home page",
    max: 150,
    note: "the FAQ and text behind a toggle are not counted",
    counts: (key) => /^(nav_|footer_|home_)/.test(key) && !key.startsWith("home_more_"),
  },
  {
    name: "the calm home page",
    max: 150,
    note: "the FAQ and text behind a toggle are not counted",
    counts: (key) => /^calm_(hero|home)_/.test(key) && !key.startsWith("calm_home_more_"),
  },
];

// Attributes whose value a visitor can see or hear. A plain string in one of
// these is text that escaped copy.yaml.
const TEXT_ATTRIBUTES = ["aria-label", "placeholder", "alt", "title"];

/** The {names} inside a text, e.g. "{count} lines" -> ["count"]. */
function placeholders(text) {
  return [...text.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]);
}

/**
 * Check the text of copy.yaml.
 *
 * `used` maps each key the code reads to the file that reads it. Returns the
 * problems as plain sentences, and the texts by key (empty if it cannot be read).
 */
export function checkCopy(yamlText, used = new Map()) {
  const errors = [];
  const texts = {};
  // uniqueKeys makes a repeated key an error instead of a silent overwrite.
  const doc = parseDocument(yamlText, { uniqueKeys: true });
  for (const problem of doc.errors) {
    const line = problem.linePos?.[0]?.line;
    // Keep the first sentence of the parser's message: the rest is a code frame.
    const reason = problem.message.split("\n")[0].replace(/ at line \d+, column \d+:?$/, "");
    errors.push(`copy.yaml: line ${line ?? "?"} cannot be read. ${reason}`);
  }
  const data = doc.errors.length ? null : doc.toJS();
  if (doc.errors.length === 0 && (data === null || typeof data !== "object" || Array.isArray(data))) {
    errors.push("copy.yaml: the file is empty or is not a list of keys");
  }
  if (errors.length) return { errors, texts };

  for (const [key, entry] of Object.entries(data)) {
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      errors.push(`copy.yaml: ${key} is not a valid name. Use small letters, digits and _ only`);
      continue;
    }
    if (entry === null || typeof entry !== "object") {
      errors.push(`copy.yaml: ${key} needs three lines under it: where, max and text`);
      continue;
    }
    const { where, max, text, keep } = entry;
    if (typeof where !== "string" || !where.trim()) errors.push(`copy.yaml: ${key} has no where`);
    if (typeof text !== "string" || !text.trim()) {
      errors.push(`copy.yaml: ${key} has no text`);
      continue; // nothing left to measure
    }
    const clean = text.trim();
    texts[key] = clean;
    if (!Number.isInteger(max) || max <= 0) {
      errors.push(`copy.yaml: ${key} has no max (a whole number of characters)`);
    } else if (clean.length > max) {
      errors.push(`copy.yaml: ${key} is ${clean.length} characters, max is ${max}`);
    }
    // keep lists the {names} the site fills in, e.g. "keep: count, time".
    const wanted = typeof keep === "string" ? keep.split(",").map((name) => name.trim()).filter(Boolean) : [];
    const present = placeholders(clean);
    for (const name of wanted) {
      if (!present.includes(name)) errors.push(`copy.yaml: ${key} must keep {${name}} in its text`);
    }
    for (const name of present) {
      if (!wanted.includes(name)) {
        errors.push(`copy.yaml: ${key} uses {${name}}, which the site does not fill in`);
      }
    }
    for (const word of BANNED) {
      // \b keeps "leverage" from matching inside a longer, innocent word.
      if (new RegExp(`\\b${word}`, "i").test(clean)) {
        errors.push(`copy.yaml: ${key} uses the banned word "${word}"`);
      }
    }
  }

  for (const [key, file] of used) {
    if (!(key in data)) errors.push(`copy.yaml: ${key} is missing. The site uses it in ${file}`);
  }
  if (used.size) {
    // Only when the code was scanned: an unused text is dead weight in the file.
    for (const key of Object.keys(data)) {
      if (!used.has(key)) errors.push(`copy.yaml: ${key} is not used anywhere on the site. Remove it`);
    }
  }

  for (const budget of BUDGETS) {
    const words = Object.entries(texts)
      .filter(([key]) => budget.counts(key))
      // A word is a run of characters between spaces. {count} counts as one.
      .reduce((sum, [, text]) => sum + text.split(/\s+/).length, 0);
    if (words > budget.max) {
      errors.push(`copy.yaml: ${budget.name} has ${words} words, max is ${budget.max} (${budget.note})`);
    }
  }
  return { errors, texts };
}

/** Every .ts and .tsx file under the code folders, tests and generated files left out. */
function codeFiles(folder) {
  const found = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...codeFiles(path));
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|gen)\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

/**
 * Read the code. Returns the copy keys it uses (key -> first file using it),
 * and a problem for each visible string that is written straight into a file.
 */
export function scanCode(root = WEB) {
  const used = new Map();
  const errors = [];
  for (const folder of CODE_FOLDERS) {
    if (!existsSync(join(root, folder))) continue;
    for (const path of codeFiles(join(root, folder))) {
      const source = readFileSync(path, "utf8");
      const name = relative(root, path);
      // "copy.some_key" is a use of a key. "copy.yaml", "copy.mjs" and
      // "copy.gen" are file names that turn up in comments and imports.
      for (const match of source.matchAll(/\bcopy\.(?!yaml\b|mjs\b|gen\b)([a-z][a-z0-9_]*)/g)) {
        if (!used.has(match[1])) used.set(match[1], name);
      }
      for (const attribute of TEXT_ATTRIBUTES) {
        // attribute="…" with a letter inside: words typed into the code.
        const pattern = new RegExp(`\\s${attribute}="([^"]*[A-Za-z][^"]*)"`, "g");
        for (const match of source.matchAll(pattern)) {
          errors.push(`${name}: the ${attribute} "${match[1]}" is written in the code. Move it to copy.yaml`);
        }
      }
    }
  }
  return { used, errors };
}

/** The TypeScript module the site imports. One line per key, in file order. */
export function generate(texts) {
  const lines = Object.entries(texts).map(([key, text]) => `  ${key}: ${JSON.stringify(text)},`);
  return [
    "// Generated from content/copy.yaml by scripts/copy.mjs. Do not edit: your",
    "// change would be overwritten. Edit content/copy.yaml instead.",
    "export const copy = {",
    ...lines,
    "} as const;",
    "",
  ].join("\n");
}

/** Check everything. Writes lib/copy.gen.ts unless checkOnly. Returns the problems. */
export function buildCopy({ checkOnly = false } = {}) {
  const scan = scanCode();
  const { errors, texts } = checkCopy(readFileSync(SOURCE, "utf8"), scan.used);
  const all = [...errors, ...scan.errors];
  if (all.length === 0 && !checkOnly) {
    const next = generate(texts);
    // Write only when the text changed. The dev server and the build both run
    // this, sometimes at the same moment; leaving an unchanged file alone means
    // no one ever reads it half-written. The rename swaps it in as one step.
    if (!existsSync(TARGET) || readFileSync(TARGET, "utf8") !== next) {
      writeFileSync(`${TARGET}.tmp`, next);
      renameSync(`${TARGET}.tmp`, TARGET);
    }
  }
  return all;
}

// Run as a command (not when a test imports the functions above).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = buildCopy({ checkOnly: process.argv.includes("--check") });
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
}
