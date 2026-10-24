"use client";

import { usePathname } from "next/navigation";
import { sitePath } from "@/lib/skin";

/**
 * The page's address without the skin folder ("/try", never "/calm/try").
 * Use it instead of usePathname: pages are built under /calm and /bold but
 * shown without them, and the plain hook would disagree between the two.
 */
export function useSitePath(): string {
  return sitePath(usePathname());
}
