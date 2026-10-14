import type { Metadata } from "next";
import { OwnerSwitch } from "@/skins/bold/OwnerSwitch";
import { page } from "@/skins/bold/ui";
import { copy } from "@/lib/copy";

// Keep this page out of search results. It is only for the site's owner.
export const metadata: Metadata = { title: copy.owner_meta_title, robots: { index: false, follow: false } };

export default function OwnerPage() {
  return (
    <div className={`${page} pt-6 lg:pt-14`}>
      <div className="max-w-2xl">
        <h1 className="head">{copy.owner_title}</h1>
        <OwnerSwitch />
      </div>
    </div>
  );
}
