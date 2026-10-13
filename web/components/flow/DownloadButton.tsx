"use client";

import { useState } from "react";
import { fetchPdf, saveBlob } from "@/lib/api";
import { copy, fill } from "@/lib/copy";
import { buildDoc } from "@/lib/resume";
import type { Result } from "@/lib/types";
import { primaryButton } from "../ui";

type Props = {
  result: Result;
  kept: Set<string>; // lines where the visitor keeps their original
  /** A ready-made PDF of the result with every rewrite in. The recorded run has one. */
  staticPdf?: string;
};

/** The main button of the result: get the resume as a PDF. */
export function DownloadButton({ result, kept, staticPdf }: Props) {
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");
  const [pages, setPages] = useState(1);

  async function download() {
    setState("working");
    try {
      // The browser holds the result, so it sends it back to be drawn.
      const pdf = await fetchPdf(buildDoc(result, kept));
      setPages(pdf.pages);
      saveBlob(pdf.blob, copy.result_file_name);
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return (
    <div>
      {staticPdf && kept.size === 0 ? (
        // Nothing was changed back, so the saved file is exactly this resume.
        // "download" makes the browser save the file instead of opening it.
        <a href={staticPdf} download={copy.result_file_name} className={`${primaryButton} w-full`}>
          {copy.result_download}
        </a>
      ) : (
        <button type="button" onClick={download} disabled={state === "working"} className={`${primaryButton} w-full`}>
          {state === "working" && <span aria-hidden className="breathe h-2.5 w-2.5 bg-black" />}
          {state === "working" ? copy.result_download_busy : copy.result_download}
        </button>
      )}
      {/* role="status" makes screen readers announce these when they appear. */}
      <p role="status" className="small mt-2 text-muted">
        {state === "failed" && <span className="text-left-out">{copy.result_download_failed}</span>}
        {/* The real page count is always said, never hidden. */}
        {state !== "failed" && pages > 1 && <span className="text-ink">{fill(copy.result_pages, { pages })}</span>}
        {state !== "failed" && pages === 1 && <span className="hidden lg:inline">{copy.result_pdf_note}</span>}
      </p>
    </div>
  );
}
