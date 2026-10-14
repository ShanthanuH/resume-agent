"use client";

import { useDownload } from "@/components/flow/useDownload";
import { copy, fill } from "@/lib/copy";
import type { Result } from "@/lib/types";
import { ArrowDot } from "../primitives";
import { primaryButton, primaryButtonPlain } from "../ui";

type Props = {
  result: Result;
  kept: Set<string>;
  /** A ready-made PDF with every rewrite in. The recorded run has one. */
  staticPdf?: string;
};

/** The main button of the result: get the resume as a PDF. */
export function DownloadButton({ result, kept, staticPdf }: Props) {
  const { state, pages, download } = useDownload(result, kept);
  const working = state === "working";
  return (
    <div>
      {staticPdf && kept.size === 0 ? (
        <a href={staticPdf} download={copy.result_file_name} className={`${primaryButton} w-full justify-between`}>
          {copy.result_download}
          <ArrowDot />
        </a>
      ) : (
        <button
          type="button"
          onClick={download}
          disabled={working}
          className={`${working ? primaryButtonPlain : `${primaryButton} justify-between`} w-full`}
        >
          {working && <span aria-hidden className="breathe h-2.5 w-2.5 rounded-full bg-white" />}
          {working ? copy.result_download_busy : copy.result_download}
          {!working && <ArrowDot />}
        </button>
      )}
      <p role="status" className="t-small mt-2 text-ink-soft">
        {state === "failed" && <span className="font-medium text-problem">{copy.result_download_failed}</span>}
        {state !== "failed" && pages > 1 && <span className="text-ink">{fill(copy.result_pages, { pages })}</span>}
        {state !== "failed" && pages === 1 && <span>{copy.result_pdf_note}</span>}
      </p>
    </div>
  );
}
