"use client";

import { diffWords } from "diff";
import { useMemo, useState } from "react";
import { fetchPdf, saveBlob } from "@/lib/api";
import { buildDoc, coverage } from "@/lib/resume";
import type { Bullet, Result } from "@/lib/types";

/** A small citation chip like [E3]. The product's visual signature. */
function Cite({ id, href }: { id: string; href?: string }) {
  const className = "rounded bg-accent-soft px-1 font-mono text-[0.7rem] font-medium text-accent";
  return href ? (
    <a href={href} className={`${className} hover:underline`}>
      {id}
    </a>
  ) : (
    <span className={className}>{id}</span>
  );
}

/** The new bullet with word-level changes marked against the original line. */
function WordDiff({ before, after }: { before: string; after: string }) {
  // diffWords returns pieces flagged as added, removed or unchanged.
  const parts = useMemo(() => diffWords(before, after), [before, after]);
  return (
    <p className="leading-relaxed">
      {parts.map((part, i) =>
        part.added ? (
          <ins key={i} className="rounded-sm bg-accent-soft text-accent decoration-accent">
            {part.value}
          </ins>
        ) : part.removed ? (
          <del key={i} className="mr-1 text-muted">
            {part.value}
          </del>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </p>
  );
}

function ChangeCard({
  bullet,
  result,
  accepted,
  onToggle,
}: {
  bullet: Bullet;
  result: Result;
  accepted: boolean;
  onToggle: (accept: boolean) => void;
}) {
  const original = bullet.replaces ? result.evidence[bullet.replaces] : "";
  const targets = result.requirements.filter((r) => bullet.requirement_ids.includes(r.id));
  return (
    <article
      id={`change-${bullet.id}`}
      className={`scroll-mt-4 rounded-lg border bg-sheet p-4 ${accepted ? "border-accent" : "border-rule"}`}
    >
      <p className="font-mono text-xs uppercase tracking-wide text-muted">
        Targets: {targets.map((t) => t.text).join(" · ")}
      </p>

      <div className="mt-3 space-y-3 text-sm">
        <div>
          <p className="mb-1 text-xs font-medium text-muted">
            From your resume {bullet.source_ids.map((id) => <Cite key={id} id={id} />)}
          </p>
          {bullet.source_ids.map((id) => (
            <p key={id} className="border-l-2 border-rule pl-3 text-muted">
              {result.evidence[id]}
            </p>
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Proposed, with changes marked</p>
          <div className="border-l-2 border-accent pl-3">
            <WordDiff before={original} after={bullet.text} />
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-accent">
        ✓ Verifier passed: every claim is in {bullet.source_ids.join(", ")}.
        {bullet.rejections.length > 0 && (
          <span className="mt-1 block text-reject">
            ✕ An earlier attempt was rejected and rewritten: {bullet.rejections.join(" ")}
          </span>
        )}
      </p>

      <div className="mt-3 flex gap-2">
        {/* aria-pressed tells screen readers which of the two is active. */}
        <button
          type="button"
          aria-pressed={accepted}
          onClick={() => onToggle(true)}
          className={`min-h-11 flex-1 rounded-md border px-3 text-sm font-medium ${accepted ? "border-accent bg-accent text-white" : "border-rule hover:border-accent"}`}
        >
          {accepted ? "Accepted" : "Accept"}
        </button>
        <button
          type="button"
          aria-pressed={!accepted}
          onClick={() => onToggle(false)}
          className={`min-h-11 flex-1 rounded-md border px-3 text-sm font-medium ${!accepted ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink"}`}
        >
          {accepted ? "Reject" : "Rejected: original kept"}
        </button>
      </div>
    </article>
  );
}

/** The resume as it will print, with a citation chip on every changed line. */
function Paper({ result, accepted }: { result: Result; accepted: Set<string> }) {
  const bullets = new Map(result.bullets.map((b) => [b.id, b]));
  const [name, ...contact] = result.header;
  return (
    <div className="rounded-sm border border-rule bg-sheet p-5 text-[0.8rem] leading-snug shadow-sm sm:p-8">
      <p className="text-center text-xl font-semibold">{name}</p>
      <p className="mt-1 break-words text-center text-xs text-muted">{contact.join(" | ")}</p>
      {result.sections.map((section) => (
        <section key={section.name} className="mt-4">
          <h3 className="border-b border-ink pb-0.5 text-xs font-semibold uppercase tracking-wider">
            {section.name}
          </h3>
          {section.entries.map((entry, i) => {
            const hasHeading = Boolean(entry.title || entry.organization);
            return (
              <div key={i} className="mt-2">
                {(hasHeading || entry.dates) && (
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <p>
                      <span className="font-semibold">{entry.title}</span>
                      {entry.title && entry.organization && ", "}
                      {entry.organization}
                    </p>
                    <p className="text-muted">{entry.dates}</p>
                  </div>
                )}
                <ul className={hasHeading ? "ml-4 list-disc" : ""}>
                  {entry.lines.map((line) => {
                    const bullet = line.bullet_id ? bullets.get(line.bullet_id) : undefined;
                    const changed = bullet && accepted.has(bullet.id);
                    return (
                      <li key={line.evidence_id} className="mt-0.5">
                        {changed ? bullet.text : line.original}
                        {changed && (
                          <>
                            {" "}
                            {/* Jumps to the review card that shows this line's sources. */}
                            <Cite id={bullet.source_ids.join(",")} href={`#change-${bullet.id}`} />
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/**
 * Review and output: the match score, each proposed change, the gap report,
 * the resume preview and the download button.
 *
 * staticPdf is a ready-made file for the "everything accepted" case. The
 * example page passes one, so its download works without calling the server.
 */
export function Workspace({ result, staticPdf }: { result: Result; staticPdf?: string }) {
  // Starts with nothing accepted on a real run: the visitor decides. The
  // example starts with everything accepted so the page shows a finished resume.
  const [accepted, setAccepted] = useState<Set<string>>(
    () => new Set(staticPdf ? result.bullets.map((b) => b.id) : []),
  );
  const [pdfState, setPdfState] = useState<"idle" | "working" | "failed">("idle");
  const [pages, setPages] = useState(1);

  const mustHaves = result.requirements.filter((r) => r.priority === "must_have");
  const must = coverage(mustHaves, accepted);
  const nice = coverage(
    result.requirements.filter((r) => r.priority === "nice_to_have"),
    accepted,
  );
  const allAccepted = accepted.size === result.bullets.length;

  function toggle(id: string, accept: boolean) {
    // Copy the set: React only re-renders when it gets a new object.
    const next = new Set(accepted);
    if (accept) next.add(id);
    else next.delete(id);
    setAccepted(next);
  }

  async function download() {
    setPdfState("working");
    try {
      const { blob, pages } = await fetchPdf(buildDoc(result, accepted));
      setPages(pages);
      saveBlob(blob, "resume-tailored.pdf");
      setPdfState("idle");
    } catch {
      setPdfState("failed");
    }
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="score">
        <h2 id="score" className="font-serif text-2xl font-semibold sm:text-3xl">
          Covers {must.covered.length} of {mustHaves.length} must-haves
        </h2>
        <p className="mt-1 text-sm text-muted">
          A must-have counts only when a line on the resume below shows it.
        </p>
        {must.gaps.length > 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-ink p-4">
            <p className="text-sm font-semibold">Not on your resume</p>
            <p className="mt-1 text-sm">{must.gaps.map((g) => g.text).join(", ")}</p>
            <p className="mt-2 text-xs text-muted">
              Nothing was written for these. If you have this experience, add it to your resume
              in your own words and run again.
            </p>
          </div>
        )}
        {must.unshown.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            On your resume, but the rewrite that highlights it is not accepted:{" "}
            {must.unshown.map((u) => u.text).join(", ")}
          </p>
        )}
        {nice.gaps.length + nice.covered.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            Nice-to-haves: covers {nice.covered.length} of{" "}
            {nice.gaps.length + nice.covered.length + nice.unshown.length}
            {nice.gaps.length > 0 && <>. Not on your resume: {nice.gaps.map((g) => g.text).join(", ")}</>}
          </p>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="changes">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="changes" className="font-serif text-2xl font-semibold">
              {result.bullets.length} proposed {result.bullets.length === 1 ? "change" : "changes"}
            </h2>
            {result.bullets.length > 0 && (
              <button
                type="button"
                onClick={() => setAccepted(new Set(allAccepted ? [] : result.bullets.map((b) => b.id)))}
                className="min-h-11 rounded-md border border-ink px-3 text-sm font-medium hover:bg-ink hover:text-paper"
              >
                {allAccepted ? "Reject all" : "Accept all"}
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            Lines not listed here stay exactly as you wrote them.
          </p>
          <div className="mt-4 space-y-4">
            {result.bullets.length === 0 && (
              <p className="rounded-lg border border-rule bg-sheet p-4 text-sm">
                The agent proposed no changes. Your lines already say what the job asks for, or
                there was no honest way to improve them.
              </p>
            )}
            {result.bullets.map((bullet) => (
              <ChangeCard
                key={bullet.id}
                bullet={bullet}
                result={result}
                accepted={accepted.has(bullet.id)}
                onToggle={(accept) => toggle(bullet.id, accept)}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="output">
          <h2 id="output" className="font-serif text-2xl font-semibold">
            Your resume
          </h2>
          <p className="mt-1 text-sm text-muted">
            Preview. Green markers show changed lines and the lines they came from. They are not
            printed in the PDF.
          </p>
          <div className="mt-4">
            <Paper result={result} accepted={accepted} />
          </div>
          <div className="mt-4">
            {staticPdf && allAccepted ? (
              // download makes the browser save the file instead of opening it.
              <a
                href={staticPdf}
                download="example-resume.pdf"
                className="flex min-h-12 items-center justify-center rounded-md bg-accent px-4 font-medium text-white hover:bg-ink"
              >
                Download PDF
              </a>
            ) : (
              <button
                type="button"
                onClick={download}
                disabled={pdfState === "working"}
                className="min-h-12 w-full rounded-md bg-accent px-4 font-medium text-white hover:bg-ink disabled:opacity-60"
              >
                {pdfState === "working" ? "Rendering…" : "Download PDF"}
              </button>
            )}
            {/* role="status" makes screen readers announce these when they appear. */}
            <p role="status" className="mt-2 text-xs text-muted">
              {pdfState === "failed" && (
                <span className="text-reject">The PDF could not be made. Please try again.</span>
              )}
              {/* A visitor who downloads without accepting would get their original back. */}
              {!allAccepted && (
                <span className="block text-ink">
                  {result.bullets.length - accepted.size} of {result.bullets.length} changes are not
                  accepted, so those lines keep your original wording.
                </span>
              )}
              {pages > 1 && `This came out at ${pages} pages. Your original may be longer than one page.`}
              {pdfState !== "failed" && pages === 1 && "One column, real text, links kept. A4."}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
