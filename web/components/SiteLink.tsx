"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { copy } from "@/lib/copy";
import { isLiveRunGoing } from "@/lib/leave-guard";

/**
 * A link to another page of this site. It behaves like next/link, with one
 * addition: while a live run is going it asks before leaving, because leaving
 * throws the run away. (Closing the tab is covered separately, in useRun.)
 */
export function SiteLink(props: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      // onNavigate fires for in-site navigation only, and can cancel it.
      onNavigate={(event) => {
        if (isLiveRunGoing() && !window.confirm(copy.run_leave_confirm)) event.preventDefault();
      }}
    />
  );
}
