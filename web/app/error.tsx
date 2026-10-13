"use client"; // error boundaries must be Client Components

import { page, primaryButton } from "@/components/ui";
import { copy } from "@/lib/copy";

/**
 * Shown when a page throws while it is being drawn. Next.js puts this in the
 * page's place, inside the normal header and footer. `retry` draws the page
 * again. The error itself is not shown: its text could hold resume content.
 */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className={`${page} pt-10 sm:pt-20`}>
      <div role="alert" className="max-w-xl">
        <h1 className="display text-[2.6rem] sm:text-[3.5rem]">{copy.crash_title}</h1>
        <p className="mt-4 text-lg text-soft">{copy.crash_text}</p>
        <button type="button" onClick={() => retry()} className={`${primaryButton} mt-8`}>
          {copy.crash_retry}
        </button>
      </div>
    </div>
  );
}
