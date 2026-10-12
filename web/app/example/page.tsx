import type { Metadata } from "next";
import Link from "next/link";
import { Trace } from "@/components/Trace";
import { Workspace } from "@/components/Workspace";
import type { SavedRun } from "@/lib/types";
// A real run, saved once by src/resume_agent/api/make_example.py. Importing the
// file puts it in the page at build time, so this page never calls the server
// or a model and loads as plain HTML.
import saved from "@/public/example.json";

export const metadata: Metadata = {
  title: "Example run",
  description: "A full run on a fictional resume: every step, every change and the PDF.",
};

export default function ExamplePage() {
  const run = saved as SavedRun;
  const { stats } = run.result;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-wide text-accent">Example</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">
        One real run, start to finish
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Meera Kulkarni is a made-up backend engineer, and Northwind Pay is a made-up company. The
        run itself is real and unedited: it took {Math.round(stats.seconds)} seconds and{" "}
        {stats.steps} steps. Nothing here calls the model again.
      </p>

      <section className="mt-10" aria-labelledby="steps">
        <h2 id="steps" className="font-serif text-2xl font-semibold">
          What the agent did
        </h2>
        <p className="mt-1 text-sm text-muted">
          It looks for evidence first. Where there is none, it writes nothing.
        </p>
        {/* details/summary is a built-in collapsible: no JavaScript needed. */}
        <details className="mt-4 rounded-lg border border-rule bg-sheet p-4">
          <summary className="min-h-6 cursor-pointer text-sm font-medium">
            Show all {run.steps.length} steps
          </summary>
          <div className="mt-4">
            <Trace steps={run.steps} />
          </div>
        </details>
      </section>

      <div className="mt-10">
        <Workspace result={run.result} staticPdf="/example.pdf" />
      </div>

      <div className="mt-12 rounded-lg border border-ink p-6 text-center">
        <p className="font-serif text-xl font-semibold">Now try it on your own resume</p>
        <Link
          href="/try"
          className="mt-4 inline-flex min-h-12 items-center rounded-md bg-accent px-6 font-medium text-white hover:bg-ink"
        >
          Try it
        </Link>
      </div>
    </div>
  );
}
