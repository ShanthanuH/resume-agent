"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OWNER_COOKIE } from "@/lib/api";

const THIRTY_DAYS = 60 * 60 * 24 * 30; // cookie lifetime, in seconds

/**
 * Stores the owner key from the address bar in a cookie, then removes it from
 * the address. Run requests send the cookie's value as the x-owner-key header,
 * and the server skips the run limits when it matches. This page never checks
 * the key itself: only the server knows the right one.
 */
export function OwnerSwitch() {
  const [state, setState] = useState<"checking" | "on" | "off" | "none">("checking");

  useEffect(() => {
    const url = new URL(window.location.href);
    // Prefer the part after "#": browsers never send it to the server, so the
    // key stays out of request logs. "?key=" also works.
    const key =
      new URLSearchParams(url.hash.slice(1)).get("key") ?? url.searchParams.get("key");
    const has = document.cookie.includes(`${OWNER_COOKIE}=`);
    let next: typeof state = has ? "on" : "none";
    if (key === "off") {
      document.cookie = `${OWNER_COOKIE}=; path=/; max-age=0`; // max-age=0 deletes it
      next = "off";
    } else if (key) {
      // Secure: sent over HTTPS only. SameSite=Strict: never sent from other sites.
      document.cookie = `${OWNER_COOKIE}=${encodeURIComponent(key)}; path=/; max-age=${THIRTY_DAYS}; Secure; SameSite=Strict`;
      next = "on";
    }
    // Take the key out of the address bar and the browser history.
    window.history.replaceState(null, "", url.pathname);
    // Reading the address bar is only possible in the browser, after the page
    // has loaded, so this state has to be set from an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(next);
  }, []);

  return (
    <div className="mt-4 space-y-4">
      {/* role="status" makes screen readers announce the outcome. */}
      <p role="status">
        {state === "checking" && "Checking…"}
        {state === "on" && "A key is saved in this browser for 30 days. If it is the right one, your runs are not counted against the limits."}
        {state === "off" && "The key was removed from this browser."}
        {state === "none" && "No key is saved in this browser."}
      </p>
      {state === "on" && (
        <p className="text-sm text-muted">
          To remove it, open <span className="font-mono">/owner#key=off</span>.
        </p>
      )}
      <Link href="/try" className="inline-flex min-h-12 items-center rounded-md bg-accent px-6 font-medium text-white hover:bg-ink">
        Go to Try it
      </Link>
    </div>
  );
}
