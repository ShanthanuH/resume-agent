import { execFileSync } from "node:child_process";
import { watch } from "node:fs";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * Check content/copy.yaml and write lib/copy.gen.ts from it.
 *
 * It runs as a separate Node process because the script is an ES module and
 * this config file is not. If the copy has a problem the script prints it in
 * plain words and exits with an error, which makes execFileSync throw.
 */
function buildCopy() {
  // stdio "inherit" lets the script's messages show in this terminal.
  execFileSync(process.execPath, ["scripts/copy.mjs"], { stdio: "inherit" });
}

// Next.js calls this once when it starts, for "next dev" and for "next build".
export default function config(phase: string): NextConfig {
  // Every build and every dev server starts with a checked, fresh copy file.
  // A text that is too long or a missing key stops the build right here.
  // ("next start" skips this: it serves what the build already made.)
  if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_BUILD) buildCopy();

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // While developing, re-run the check whenever copy.yaml is saved, so a
    // changed word shows in the browser without a restart. The folder is
    // watched, not the file: many editors save by replacing the file, which a
    // watch on the file itself would lose track of.
    let timer: NodeJS.Timeout | undefined;
    watch("content", (_event, name) => {
      if (name !== "copy.yaml") return;
      clearTimeout(timer); // editors fire several events per save: wait for the last
      timer = setTimeout(() => {
        try {
          buildCopy();
        } catch {
          // The problem is already printed. Keep the server and the old copy.
        }
      }, 100);
    });
  }

  return {
    // Cache Components is left off: every page here is static or runs in the
    // browser.
    env: {
      // "preview" on a Vercel preview deployment, "production" on the live
      // site, empty on a laptop. lib/config.ts reads it: previews only ever
      // play the recorded run.
      NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
    },
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };
}
