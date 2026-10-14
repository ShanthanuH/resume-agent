"use client";

import { useState } from "react";
import { lineAnchor } from "@/lib/result-text";

/**
 * The visitor's choices on the result: which lines keep their original (every
 * rewrite starts out in), and which changed line is open.
 */
export function useKeptLines() {
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  function keep(bulletId: string, keepOriginal: boolean) {
    // Copy the set: React only re-draws when it is handed a new object.
    const next = new Set(kept);
    if (keepOriginal) next.add(bulletId);
    else next.delete(bulletId);
    setKept(next);
  }

  /** Open one changed line and bring it to the middle of the screen. */
  function jumpTo(bulletId: string) {
    setOpenId(bulletId);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(lineAnchor(bulletId))?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  }

  return { kept, keep, openId, setOpenId, jumpTo };
}
