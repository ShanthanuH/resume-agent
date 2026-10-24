"use client"; // error boundaries must be Client Components

import { Glass } from "@/skins/calm/parts";
import { PageFrame, inkButton } from "@/skins/calm/pages/PageFrame";
import { copy } from "@/lib/copy";

/**
 * Shown when a page throws while it is being drawn. The error itself is not
 * shown: its text could hold resume content. The button reloads the page.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ErrorPage(_props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <PageFrame>
      <Glass role="alert" className="rounded-[28px] p-8">
        <h1 className="font-serif text-[38px] leading-[1.1] text-ink-900 wide:text-[46px]">{copy.calm_500_title}</h1>
        <p className="mt-4 text-[17px] leading-[1.6] text-ink-700">{copy.crash_text}</p>
        <button type="button" onClick={() => window.location.reload()} className={`${inkButton} mt-7`}>
          {copy.calm_500_button}
        </button>
      </Glass>
    </PageFrame>
  );
}
