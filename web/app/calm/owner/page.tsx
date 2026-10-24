import type { Metadata } from "next";
import { OwnerSwitch } from "@/skins/calm/OwnerSwitch";
import { Glass } from "@/skins/calm/parts";
import { PageFrame } from "@/skins/calm/pages/PageFrame";
import { copy } from "@/lib/copy";

// Keep this page out of search results. It is only for the site's owner.
export const metadata: Metadata = { title: copy.owner_meta_title, robots: { index: false, follow: false } };

export default function OwnerPage() {
  return (
    <PageFrame>
      <Glass className="rounded-[28px] p-8">
        <h1 className="font-serif text-[38px] leading-[1.1] text-ink-900 wide:text-[46px]">{copy.owner_title}</h1>
        <div className="mt-5">
          <OwnerSwitch />
        </div>
      </Glass>
    </PageFrame>
  );
}
