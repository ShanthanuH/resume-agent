import type { Metadata } from "next";
import { SiteLink } from "@/components/SiteLink";
import { Glass } from "@/skins/calm/parts";
import { PageFrame, inkButton } from "@/skins/calm/pages/PageFrame";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.notfound_title };

/** Shown for any address that is not a page of this site (HTTP 404). */
export default function NotFound() {
  return (
    <PageFrame>
      <Glass className="rounded-[28px] p-8">
        <h1 className="font-serif text-[38px] leading-[1.1] text-ink-900 wide:text-[46px]">{copy.calm_404_title}</h1>
        <p className="mt-4 text-[17px] leading-[1.6] text-ink-700">{copy.notfound_text}</p>
        <SiteLink href="/" className={`${inkButton} mt-7`}>
          {copy.calm_404_button}
        </SiteLink>
      </Glass>
    </PageFrame>
  );
}
