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
        options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

/**
 * Cloudflare's bot check. It gives the page a one-time token, which the server
 * verifies before it starts a run. Renders nothing when no site key is set.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false); // true once Cloudflare's script is ready

  useEffect(() => {
    if (!loaded || !box.current || !window.turnstile) return;
    const id = window.turnstile.render(box.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: onToken,
      "expired-callback": () => onToken(""), // tokens expire after a few minutes
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
      <div ref={box} className="min-h-[65px]" />
    </>
  );
}
