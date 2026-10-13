"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/config";

// The small part of Cloudflare's script that this component uses.
declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          appearance: "always" | "execute" | "interaction-only";
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

/**
 * Cloudflare's bot check. It gives the page a one-time token, which the server
 * verifies before it starts a run. Renders nothing when no site key is set.
 *
 * A token works once. The form (and this widget with it) leaves the page while
 * a run is going, so coming back to the form makes a new widget and a new token.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false); // true once Cloudflare's script is ready

  useEffect(() => {
    if (!loaded || !box.current || !window.turnstile) return;
    const id = window.turnstile.render(box.current, {
      sitekey: TURNSTILE_SITE_KEY,
      // Most visitors pass without being asked anything. "interaction-only"
      // keeps the widget hidden for them and shows it only when Cloudflare
      // needs a click, so the form stays three calm steps.
      appearance: "interaction-only",
      callback: onToken,
      "expired-callback": () => onToken(""), // tokens expire after a few minutes
      "error-callback": () => onToken(""), // no token: the server will refuse, and say why
    });
    return () => window.turnstile?.remove(id); // clean up when the form goes away
  }, [loaded, onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      {/* render=explicit: the script waits for our render() call above. */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        // onReady fires on every mount, also when the script was loaded earlier.
        onReady={() => setLoaded(true)}
      />
      {/* Empty, so it takes no room, unless Cloudflare shows its challenge here. */}
      <div ref={box} className="empty:hidden [&:not(:empty)]:mb-4" />
    </>
  );
}
