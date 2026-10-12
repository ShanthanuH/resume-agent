import Link from "next/link";
import { GITHUB_URL } from "@/lib/config";

// Every sentence on this page follows the product's own rule: no claim we
// cannot back. No speed claims, no "beats the ATS", no unmeasured numbers.

const STEPS = [
  {
    title: "It reads your resume line by line",
    body: "Each line is copied word for word and given an ID. These lines are the only facts the agent may use.",
  },
  {
    title: "It rewrites only where there is evidence",
    body: "For each thing the job asks for, it looks for a line that shows it. No line, no bullet: the requirement goes to a gap report instead.",
  },
  {
    title: "A verifier checks every rewrite",
    body: "Numbers, tools, titles and scope must match the cited lines. A bullet that fails is rewritten or dropped. You see each check as it runs.",
  },
];

const FAQ = [
  {
    q: "Will it add keywords from the job description?",
    a: "Only if your resume already shows that experience. If the job asks for Kubernetes and your resume never mentions it, you get a line in the gap report, not a bullet.",
  },
  {
    q: "Will this get me past an ATS?",
    a: "We do not promise that. The PDF is ATS-friendly: one column, real text, standard headings. No tool can honestly guarantee how a company's software scores a resume.",
  },
  {
    q: "Why did it change so few lines?",
    a: "A line is rewritten only when the rewrite is better for this job and passes the verifier. If your line already says it well, it stays exactly as you wrote it.",
  },
  {
    q: "What can I upload?",
    a: "A PDF with selectable text, up to 2 MB, or you can paste the text. Scanned PDFs do not work.",
  },
  {
    q: "Is it free?",
    a: "Yes. To keep costs under control there is a limit of a few runs per person per day, and a daily limit for everyone together.",
  },
];

/** The hero's picture: one rewritten bullet with its citation, drawn in HTML. */
function Specimen() {
  return (
    <figure className="rounded-lg border border-rule bg-sheet p-5 text-sm shadow-sm">
      <figcaption className="font-mono text-xs uppercase tracking-wide text-muted">
        From the example run
      </figcaption>
      <p className="mt-3 text-xs font-medium text-muted">
        Your line <span className="rounded bg-accent-soft px-1 font-mono text-accent">E3</span>
      </p>
      <p className="mt-1 border-l-2 border-rule pl-3 text-muted">
        Cut median API response time from 420 ms to 150 ms by adding Redis caching and fixing slow
        PostgreSQL queries
      </p>
      <p className="mt-4 text-xs font-medium text-muted">Tailored for “PostgreSQL query tuning”</p>
      <p className="mt-1 border-l-2 border-accent pl-3">
        Tuned slow PostgreSQL queries and added Redis caching, cutting median API response time from
        420 ms to 150 ms{" "}
        <span className="rounded bg-accent-soft px-1 font-mono text-xs text-accent">E3</span>
      </p>
      <p className="mt-4 text-xs text-accent">✓ Verifier passed: both numbers and both tools are in E3.</p>
      <p className="mt-2 border-t border-dashed border-rule pt-2 text-xs">
        <span className="font-semibold">Not on your resume:</span> Kubernetes, Terraform, Kafka
      </p>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <section className="grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-2">
        <div>
          <h1 className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Tailor your resume to any job. Nothing invented.
          </h1>
          <p className="mt-5 text-lg text-muted">
            Every rewritten line points back to the line on your resume it came from. What the job
            asks for and you do not have is listed plainly, not made up.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/try"
              className="flex min-h-12 items-center justify-center rounded-md bg-accent px-6 font-medium text-white hover:bg-ink"
            >
              Try it
            </Link>
            <Link
              href="/example"
              className="flex min-h-12 items-center justify-center rounded-md border border-ink px-6 font-medium hover:bg-ink hover:text-paper"
            >
              See an example
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">Free. No account. Your resume is not stored.</p>
        </div>
        <Specimen />
      </section>

      <section className="border-t border-rule py-12" aria-labelledby="how">
        <h2 id="how" className="font-serif text-3xl font-semibold">
          How it works
        </h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <p className="font-mono text-sm text-accent">[{i + 1}]</p>
              <h3 className="mt-2 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-rule py-12" aria-labelledby="eval">
        <h2 id="eval" className="font-serif text-3xl font-semibold">
          Does it work?
        </h2>
        <div className="mt-6 rounded-lg border border-dashed border-ink p-6">
          <p className="font-mono text-xs uppercase tracking-wide text-accent">Evaluation in progress</p>
          <p className="mt-3 max-w-2xl">
            We are measuring how often this agent adds a claim the original resume does not support,
            compared with plain prompting, on 30 real job descriptions and 3 resumes. The number
            goes here when it is measured, along with the cases where the agent loses.
          </p>
          <p className="mt-3 text-sm text-muted">
            Until then we make no accuracy claim. You can check every change yourself: each one
            shows its source line.
          </p>
        </div>
      </section>

      <section className="border-t border-rule py-12" aria-labelledby="privacy">
        <h2 id="privacy" className="font-serif text-3xl font-semibold">
          Your resume stays yours
        </h2>
        <p className="mt-4 max-w-2xl text-muted">
          We do not store your resume or the job description. Your email, phone number and links
          are removed before any text is sent to the AI model, and put back only in your result.
          Our logs hold numbers, like how long a run took, never your text.{" "}
          <Link href="/privacy" className="text-accent underline underline-offset-4">
            Read the privacy page
          </Link>
          .
        </p>
      </section>

      <section className="border-t border-rule py-12" aria-labelledby="faq">
        <h2 id="faq" className="font-serif text-3xl font-semibold">
          Questions
        </h2>
        <dl className="mt-6 max-w-2xl space-y-6">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-1 text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-sm text-muted">
          The code is open.{" "}
          <a href={GITHUB_URL} className="text-accent underline underline-offset-4">
            Read it on GitHub
          </a>
          .
        </p>
      </section>
    </div>
  );
}
