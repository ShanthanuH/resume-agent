// Small helpers that turn numbers into what the page shows.

/** Seconds as minutes and seconds: 64 -> "1:04". */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** A file size the way a person says it: 84212 -> "84 KB", 1300000 -> "1.2 MB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * When the day's runs open again, in the visitor's own clock: "5:30 AM".
 * The server counts days in UTC, so that moment is the next UTC midnight.
 */
export function nextResetTime(now: Date = new Date()): string {
  // Date.UTC with day + 1 is tomorrow at 00:00 UTC; it rolls over months by itself.
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return reset.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
