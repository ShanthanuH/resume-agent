// The site has two skins: "calm" (light, daylight photo) and "bold" (black,
// flat colour fields). They share every piece of logic and every word; only
// the drawing differs. Each skin is its own tree of pages under app/calm and
// app/bold, and proxy.ts sends each visitor to one of them without changing
// the address they see.
//
// Which skin a visitor gets, first match wins:
//   1. ?design=calm or ?design=bold in the address (then remembered)
//   2. the remembered choice, in a cookie
//   3. NEXT_PUBLIC_DESIGN, set per deployment (default "calm")

export const SKINS = ["calm", "bold"] as const;
export type Skin = (typeof SKINS)[number];

/** The cookie that remembers a ?design= choice. */
export const SKIN_COOKIE = "design";
/** How long the choice is remembered: 30 days. */
export const SKIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function isSkin(value: string | null | undefined): value is Skin {
  return (SKINS as readonly string[]).includes(value ?? "");
}

/** The deployment's default. An unknown value falls back to calm. */
export const DEFAULT_SKIN: Skin = isSkin(process.env.NEXT_PUBLIC_DESIGN) ? process.env.NEXT_PUBLIC_DESIGN : "calm";

/** Pick the skin for one request. `asked` is ?design=, `remembered` the cookie. */
export function pickSkin(asked: string | null, remembered: string | undefined, fallback: Skin = DEFAULT_SKIN): Skin {
  if (isSkin(asked)) return asked;
  if (isSkin(remembered)) return remembered;
  return fallback;
}

/**
 * The address as the visitor sees it: "/calm/try" (how the page was built)
 * and "/try" (what the browser shows) both give "/try". Server and browser
 * then agree, which keeps React from complaining when the page wakes up.
 */
export function sitePath(pathname: string): string {
  const match = /^\/(calm|bold)(\/.*)?$/.exec(pathname);
  if (!match) return pathname;
  return match[2] ?? "/";
}
