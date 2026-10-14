"use client";

import { useEffect, useState } from "react";
import { OWNER_COOKIE } from "@/lib/api";
import { copy, fill } from "@/lib/copy";
import { SiteLink } from "@/components/SiteLink";
import { primaryButton } from "./ui";

const THIRTY_DAYS = 60 * 60 * 24 * 30; // cookie lifetime, in seconds
const REMOVE_ADDRESS = "/owner#key=off"; // opening this deletes the saved key

// What the page says in each state.
const MESSAGE = {
  checking: copy.owner_checking,
  on: copy.owner_on,
  off: copy.owner_off,
  none: copy.owner_none,
};

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
    <div className="mt-6 space-y-5">
      {/* role="status" makes screen readers announce the outcome. */}
      <p role="status" className="lead">
        {MESSAGE[state]}
      </p>
      {state === "on" && (
        <p className="small text-muted">{fill(copy.owner_remove_hint, { address: REMOVE_ADDRESS })}</p>
      )}
      <SiteLink href="/try" className={primaryButton}>
        {copy.owner_go}
      </SiteLink>
    </div>
  );
}
