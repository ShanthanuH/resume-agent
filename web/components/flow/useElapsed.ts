"use client";

import { useEffect, useState } from "react";

/**
 * Seconds since `startedAt` (a Date.now() value), counted up while mounted.
 *
 * `speed` is for a replay that plays faster than life: at speed 16 the clock
 * also runs sixteen times faster, so it shows the run's real time, not ours.
 * Returns 0 while startedAt is null (the run has not begun).
 */
export function useElapsed(startedAt: number | null, speed = 1): number {
  // The time of the last tick. Starting it at startedAt makes the first value 0.
  const [now, setNow] = useState(startedAt ?? 0);
  useEffect(() => {
    if (startedAt === null) return;
    // One tick per shown second, but never more than 20 a second.
    const timer = setInterval(() => setNow(Date.now()), Math.max(50, 1000 / speed));
    return () => clearInterval(timer);
  }, [startedAt, speed]);
  if (startedAt === null) return 0;
  return (Math.max(0, now - startedAt) / 1000) * speed;
}
