"use client"; // error boundaries must be Client Components

import { chapter, inkButton, page } from "@/components/ui";
import { copy } from "@/lib/copy";

/**
 * Shown when a page throws while it is being drawn. Next.js puts this in the
 * page's place, inside the normal header and footer. `retry` draws the page
 * again. The error itself is not shown: its text could hold resume content.
 * Orange is the site's colour for "went wrong".
 */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section role="alert" className="field-left-out">
      <div className={`${page} ${chapter} flex min-h-[72svh] flex-col justify-end`}>
        <h1 className="head max-w-[14ch]">{copy.crash_title}</h1>
        <p className="lead mt-6 max-w-[34ch]">{copy.crash_text}</p>
        <button type="button" onClick={() => retry()} className={`${inkButton} mt-10 self-start`}>
          {copy.crash_retry}
        </button>
      </div>
    </section>
  );
}
