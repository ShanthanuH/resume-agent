"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { copy } from "@/lib/copy";
import { handOver } from "@/lib/handoff";
import { SiteLink } from "@/components/SiteLink";
import { inkButton } from "./ui";

/**
 * The flow's first step, already open on the home page: the white box the
 * resume goes into. Choosing a file here opens the flow with that file in.
 * The button under it opens the flow empty, for pasting text.
 */
export function StartHere() {
  const router = useRouter();
  const picker = useId(); // connects the visible box to the hidden file input
  return (
    // data-ui: a piece of the product's own interface (see Paper.tsx).
    <div data-ui className="w-full">
      {/* The whole box is the label of the file input, so a tap anywhere on
          it opens the file picker. The outline shows when the input has
          keyboard focus. */}
      <label
        htmlFor={picker}
        className="field-sheet flex min-h-44 cursor-pointer lg:min-h-72 items-center justify-center px-6 text-center transition-transform duration-[120ms] ease-swoosh hover:-translate-y-0.5 has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-[3px] has-[input:focus-visible]:outline-black"
      >
        <input
          id={picker}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            if (!picked) return;
            handOver(picked); // the flow page picks it up when it opens
            router.push("/try");
          }}
        />
        <span className="lead font-bold">{copy.flow_drop}</span>
      </label>
      <SiteLink href="/try" className={`${inkButton} mt-1 w-full`}>
        {copy.home_cta}
      </SiteLink>
    </div>
  );
}
