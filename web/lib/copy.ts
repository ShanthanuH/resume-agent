// The words of the site. They come from content/copy.yaml: scripts/copy.mjs
// checks that file and writes copy.gen.ts, which is re-exported here.
//
// Use it as `copy.home_title_1`. Always write the key out in full like that:
// the check finds the keys the code uses by looking for "copy.<key>", and
// TypeScript reports a key that does not exist.
export { copy } from "./copy.gen";

/**
 * Put values into a text: fill("{count} lines changed", { count: 2 }) gives
 * "2 lines changed". A {name} with no value is left as it is, so a mistake is
 * visible on the page instead of silently disappearing.
 */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{([a-z_]+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}
