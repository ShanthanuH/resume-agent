"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startRun } from "@/lib/api";
import {
  MAX_FILE_BYTES,
  MAX_JD_CHARS,
  MAX_RESUME_CHARS,
  MIN_CHARS,
  TURNSTILE_SITE_KEY,
} from "@/lib/config";
import type { Result, Step } from "@/lib/types";
import { Trace } from "./Trace";
import { Turnstile } from "./Turnstile";
import { Workspace } from "./Workspace";

type Stage = "input" | "running" | "review";

const field =
  "w-full rounded-md border border-rule bg-sheet p-3 text-base placeholder:text-muted focus:border-accent";

/**
 * The whole product flow on one page: input, live run, then review and output.
 *
 * Everything lives in this component's memory. Nothing is saved, so a reload
 * starts again from the input screen.
 */
export function TryFlow() {
  const [stage, setStage] = useState<Stage>("input");
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  // Lets us cancel the request if the visitor leaves the page mid-run.
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);

  // Keep the newest step in view while the run is streaming.
  useEffect(() => {
    if (stage === "running") bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [steps, stage]);

  // useCallback keeps one function identity, so the widget is not re-created
  // every time this component re-renders.
  const onToken = useCallback((value: string) => setToken(value), []);

  /** Check the input in the browser first. Returns a message, or "" if fine. */
  function problem(): string {
    if (mode === "upload") {
      if (!file) return "Choose your resume PDF, or switch to pasting the text.";
      if (file.type !== "application/pdf") return "Only PDF files work for now. You can also paste the text.";
      if (file.size > MAX_FILE_BYTES) return "That file is over 2 MB. Try a smaller PDF, or paste the text.";
    } else {
      if (resumeText.trim().length < MIN_CHARS) return "Paste the full text of your resume.";
      if (resumeText.length > MAX_RESUME_CHARS) return "That resume is too long. Keep it under about four pages.";
    }
    if (jdText.trim().length < MIN_CHARS) return "Paste the full job description.";
    if (jdText.length > MAX_JD_CHARS) return "That job description is too long. Paste only the posting.";
    if (TURNSTILE_SITE_KEY && !token) return "Wait a moment for the bot check to finish, then try again.";
    return "";
  }

  function submit(event: React.FormEvent) {
    event.preventDefault(); // stop the browser's own form post and page reload
    const found = problem();
    setError(found);
    if (found) return;

    const form = new FormData();
    if (mode === "upload" && file) form.set("resume_file", file);
    else form.set("resume_text", resumeText);
    form.set("jd_text", jdText);
    form.set("turnstile_token", token);

    setSteps([]);
    setStatus("Starting");
    setStage("running");
    setToken(""); // a token works once; the widget issues a new one for the next run
    abort.current = new AbortController();
    startRun(
      form,
      {
        onStatus: setStatus,
        // The updater form appends to the latest list, even when several
        // steps arrive in the same moment.
        onStep: (step) => setSteps((previous) => [...previous, step]),
        onDone: (done) => {
          setResult(done);
          setStage("review");
          window.scrollTo({ top: 0 });
        },
        onFailed: (message) => {
          setError(message);
          setStage("input");
        },
      },
      abort.current.signal,
    );
  }

  if (stage === "running") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold">The agent is working</h1>
        <p className="mt-2 text-sm text-muted">
          Every step is shown as it happens, including the ones where it checks itself. Keep this
          tab open.
        </p>
        {/* aria-live reads new status text out to screen-reader users. */}
        <p aria-live="polite" className="mt-6 flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-accent">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
          {steps.length === 0 ? status : `Step ${steps.length}`}
        </p>
        <div className="mt-4">
          <Trace steps={steps} animate />
        </div>
        <div ref={bottom} className="h-8" />
      </div>
    );
  }

  if (stage === "review" && result) {
    return (
      <div>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4 text-sm">
          <p className="text-muted">
            Done in {Math.round(result.stats.seconds)} s, {result.stats.steps} steps. Nothing was saved.
          </p>
          <div className="flex gap-4">
            <button type="button" onClick={() => setShowTrace(!showTrace)} className="min-h-11 underline underline-offset-4">
              {showTrace ? "Hide the steps" : "Show the steps"}
            </button>
            <button type="button" onClick={() => setStage("input")} className="min-h-11 underline underline-offset-4">
              Start over
            </button>
          </div>
        </div>
        {showTrace && (
          <div className="mb-10 rounded-lg border border-rule bg-sheet p-4">
            <Trace steps={steps} />
          </div>
        )}
        <Workspace result={result} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl">
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Tailor your resume</h1>
      <p className="mt-2 text-muted">
        Add your resume and the job description. You review every change before anything is final.
      </p>

      <fieldset className="mt-8">
        <legend className="font-semibold">1. Your resume</legend>
        <div className="mt-2 flex gap-2 text-sm">
          {(["upload", "paste"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={`min-h-11 rounded-md border px-4 font-medium ${mode === option ? "border-ink bg-ink text-paper" : "border-rule"}`}
            >
              {option === "upload" ? "Upload PDF" : "Paste text"}
            </button>
          ))}
        </div>
        {mode === "upload" ? (
          <label className="mt-3 block cursor-pointer rounded-md border border-dashed border-ink bg-sheet p-6 text-center text-sm">
            {/* The real input is hidden but still reachable by keyboard and screen readers. */}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <span className="font-medium">{file.name}</span>
            ) : (
              <span>
                <span className="font-medium underline underline-offset-4">Choose a PDF</span>
                <span className="mt-1 block text-muted">Up to 2 MB. Links in the PDF are kept.</span>
              </span>
            )}
          </label>
        ) : (
          <textarea
            aria-label="Resume text"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={10}
            placeholder="Paste the full text of your resume"
            className={`mt-3 ${field}`}
          />
        )}
      </fieldset>

      <div className="mt-8">
        <label htmlFor="jd" className="font-semibold">
          2. The job description
        </label>
        <textarea
          id="jd"
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={10}
          placeholder="Paste the text of the job posting. Links do not work, since job sites block them."
          className={`mt-2 ${field}`}
        />
      </div>

      <div className="mt-6">
        <Turnstile onToken={onToken} />
      </div>

      {/* role="alert" makes screen readers read the error as soon as it shows. */}
      {error && (
        <p role="alert" className="mt-4 rounded-md border border-reject bg-reject-soft p-3 text-sm text-reject">
          {error}
        </p>
      )}

      <button type="submit" className="mt-6 min-h-12 w-full rounded-md bg-accent px-4 text-base font-medium text-white hover:bg-ink">
        Tailor my resume
      </button>
      <p className="mt-3 text-xs text-muted">
        Your resume is processed in memory and never stored. Your email, phone number and links are
        removed before any text goes to the AI model. See the privacy page for details.
      </p>
    </form>
  );
}
