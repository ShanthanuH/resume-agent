import type { Metadata } from "next";
import { OwnerSwitch } from "@/components/OwnerSwitch";

// Keep this page out of search results. It is only for the site's owner.
export const metadata: Metadata = { title: "Owner", robots: { index: false, follow: false } };

export default function OwnerPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Owner mode</h1>
      <OwnerSwitch />
    </div>
  );
}
