import type { Metadata } from "next";
import { OwnerSwitch } from "@/skins/calm/OwnerSwitch";
import { Card } from "@/skins/calm/primitives";
import { page, pageTop } from "@/skins/calm/ui";
import { copy } from "@/lib/copy";

// Keep this page out of search results. It is only for the site's owner.
export const metadata: Metadata = { title: copy.owner_meta_title, robots: { index: false, follow: false } };

export default function OwnerPage() {
  return (
    <div className={`bg-mist ${pageTop}`}>
      <div className={`${page} pb-24 sm:pb-32`}>
        <div className="max-w-xl">
          <h1 className="t-title">{copy.owner_title}</h1>
          <Card className="mt-8">
            <OwnerSwitch />
          </Card>
        </div>
      </div>
    </div>
  );
}
