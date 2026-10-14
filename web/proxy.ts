import { NextResponse, type NextRequest } from "next/server";
import { pickSkin, SKIN_COOKIE, SKIN_COOKIE_MAX_AGE } from "@/lib/skin";

/**
 * Sends each page request to one skin's copy of the page. "/try" is served
 * from app/calm/try or app/bold/try; the address in the browser stays "/try".
 * Both copies are built ahead of time, so this only picks a file: no page is
 * drawn per request. See lib/skin.ts for how the skin is chosen.
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  // A skin's own folder, asked for directly: serve it as it is. This is also
  // how the link-preview images (/calm/opengraph-image) are reached.
  if (/^\/(calm|bold)(\/|$)/.test(pathname)) return NextResponse.next();

  const asked = searchParams.get("design");
  const skin = pickSkin(asked, request.cookies.get(SKIN_COOKIE)?.value);
  const url = request.nextUrl.clone();
  url.pathname = `/${skin}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.rewrite(url);
  // Remember a choice made in the address, so it holds on the next page.
  if (asked === skin) {
    response.cookies.set(SKIN_COOKIE, skin, { path: "/", maxAge: SKIN_COOKIE_MAX_AGE, sameSite: "lax" });
  }
  return response;
}

export const config = {
  // Pages only: not the API, Next.js's own files, or files in public/ (any
  // path with a dot in its last part, like /hero/hero-wide.webp).
  matcher: ["/((?!api/|_next/|health$|[^?]*\\.[^/?]+$).*)"],
};
