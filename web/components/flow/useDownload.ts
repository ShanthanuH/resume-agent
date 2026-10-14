"use client";

import { useState } from "react";
import { fetchPdf, saveBlob } from "@/lib/api";
import { copy } from "@/lib/copy";
import { buildDoc } from "@/lib/resume";
import type { Result } from "@/lib/types";

/**
 * Getting the result as a PDF. The browser holds the result, so it sends it
 * back to be drawn. `pages` is the real page count of the last PDF made.
 */
export function useDownload(result: Result, kept: Set<string>) {
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");
  const [pages, setPages] = useState(1);

  async function download() {
    setState("working");
    try {
      const pdf = await fetchPdf(buildDoc(result, kept));
      setPages(pdf.pages);
      saveBlob(pdf.blob, copy.result_file_name);
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return { state, pages, download };
}
