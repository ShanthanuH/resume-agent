import type { Metadata } from "next";
import { OwnerSwitch } from "@/components/OwnerSwitch";
import { page } from "@/components/ui";
import { copy } from "@/lib/copy";

// Keep this page out of search results. It is only for the site's owner.
export const metadata: Metadata = { title: copy.owner_meta_title, robots: { index: false, follow: false } };

export default function OwnerPage() {
  return (
    <div className={`${page} pt-6 sm:pt-12`}>
      <div className="max-w-xl">
        <h1 className="display text-[2rem] sm:text-[2.5rem]">{copy.owner_title}</h1>
        <OwnerSwitch />
      </div>
    </div>
  );
}
