"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { copy } from "@/lib/copy";
import { handOver } from "@/lib/handoff";
import { ArrowDot, Card } from "../primitives";
import { field, inlineLink, primaryButton } from "../ui";

/**
 * The upload card in the hero: a resume PDF, the job post, one button. It
 * hands what was given to the /try page, which presses the button itself.
 */
export function HeroCard() {
  const router = useRouter();
  const fileId = useId();
  const jobId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [jobText, setJobText] = useState("");
  const [over, setOver] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (file !== null || jobText.trim() !== "") handOver({ file: file ?? undefined, jobText, start: true });
    router.push("/try");
  }

  return (
    <Card tone="float" coreClassName="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="t-small mb-2 font-medium text-ink">{copy.flow_step_resume}</p>
          <label
            htmlFor={fileId}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(false);
              const dropped = event.dataTransfer.files[0];
              if (dropped) setFile(dropped);
            }}
            className={`flex min-h-24 flex-col items-center justify-center gap-0.5 rounded-field px-4 py-4 text-center ring-1 transition-colors duration-[160ms] ease-calm focus-within:ring-2 focus-within:ring-sky-ink ${
              over ? "bg-sky-wash ring-sky-ink" : "bg-mist ring-ink/15 hover:bg-sky-wash"
            }`}
          >
            <input
              id={fileId}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {file ? (
              <span className="break-all font-medium text-ink">{file.name}</span>
            ) : (
              <>
                <span className="font-medium text-ink">{copy.flow_drop}</span>
                <span className="t-small text-ink-soft">{copy.flow_drop_hint}</span>
              </>
            )}
          </label>
        </div>
        <div>
          <label htmlFor={jobId} className="t-small mb-2 block font-medium text-ink">
            {copy.flow_step_job}
          </label>
          <textarea
            id={jobId}
            rows={3}
            value={jobText}
            onChange={(event) => setJobText(event.target.value)}
            placeholder={copy.flow_job_placeholder}
            className={`${field} resize-none`}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <button type="submit" className={primaryButton}>
            {copy.flow_submit}
            <ArrowDot />
          </button>
          <a href="/try" className={`${inlineLink} t-small inline-flex min-h-11 items-center`}>
            {copy.flow_paste_instead}
          </a>
        </div>
      </form>
    </Card>
  );
}
