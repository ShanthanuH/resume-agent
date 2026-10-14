"use client"; // error boundaries must be Client Components

import { ArrowDot, Card } from "@/skins/calm/primitives";
import { page, pageTop, primaryButton } from "@/skins/calm/ui";
import { copy } from "@/lib/copy";

/**
 * Shown when a page throws while it is being drawn. Next.js puts this in the
 * page's place, inside the normal header and footer. `retry` draws the page
 * again. The error itself is not shown: its text could hold resume content.
 */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section role="alert" className={`bg-mist ${pageTop}`}>
      <div className={`${page} pb-24 sm:pb-32`}>
        <Card className="mx-auto max-w-xl" coreClassName="p-7 sm:p-10">
          <h1 className="t-title">{copy.crash_title}</h1>
          <p className="t-lead mt-5 text-ink-soft">{copy.crash_text}</p>
          <button type="button" onClick={() => retry()} className={`${primaryButton} mt-8`}>
            {copy.crash_retry}
            <ArrowDot />
          </button>
        </Card>
      </div>
    </section>
  );
}
