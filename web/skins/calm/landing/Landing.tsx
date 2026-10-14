"use client";

import Link from "next/link";
import { copy } from "@/lib/copy";
import type { LandingProps } from "../flow/contracts";
import { IDS } from "../flow/contracts";
import { Wordmark } from "../parts";


/** The landing page: the hero with its card, then the sections. */
export function Landing({ heroCard, sections, facts }: LandingProps) {
  return (
    <div className="bg-page font-sans text-ink-900">
      <header className="sky-hero hero-dark relative box-border flex min-h-svh flex-col wide:min-h-[820px]">
        {/* Phone: a dark top, so the white wordmark and title can be read. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[300px] bg-[linear-gradient(180deg,rgba(11,35,64,0.28)_0%,rgba(11,35,64,0)_100%)] wide:hidden" />
        <nav className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-4 wide:px-[clamp(20px,4vw,56px)] wide:py-6">
          <Wordmark light className="text-[26px] wide:text-ink-900 wide:text-[30px]" />
          {/* The recorded run, played through the real screens. The form is
              right below, so the nav needs no second "Tailor my resume". */}
          <Link
            href="/example"
            className="glass lift inline-flex min-h-11 items-center rounded-full px-4 py-3 text-[14px] font-semibold text-ink-900 no-underline wide:px-5 wide:py-[11px] wide:text-[15px]"
          >
            {copy.calm_nav_how}
          </Link>
        </nav>
        <div className="relative flex grow flex-col wide:mx-auto wide:box-border wide:grid wide:w-full wide:max-w-[1360px] wide:grid-cols-[minmax(0,1fr)_minmax(0,540px)] wide:items-center wide:gap-10 wide:px-[clamp(20px,5vw,72px)] wide:pb-[120px]">
          <div aria-hidden className="hidden wide:block" />
          <div className="flex grow flex-col wide:grow-0 wide:gap-[18px]">
            <div className="flex flex-col gap-2.5 px-5 pt-[18px] wide:gap-[18px] wide:p-0">
              <h1 className="m-0 font-serif text-[50px] leading-[0.98] font-normal tracking-[-0.5px] text-white [text-shadow:0_2px_16px_rgba(11,35,64,0.3)] wide:text-[clamp(50px,5.6vw,80px)] wide:tracking-[-1px] wide:text-ink-900 wide:[text-shadow:none]">
                {copy.calm_hero_title_1}
                <br />
                <span className="italic">{copy.calm_hero_title_2}</span>
              </h1>
              <p className="m-0 text-[16px] leading-[1.5] font-medium text-white [text-shadow:0_1px_8px_rgba(11,35,64,0.5)] wide:max-w-[470px] wide:text-[19px] wide:font-normal wide:text-ink-700 wide:[text-shadow:none]">
                {copy.calm_hero_sub}
              </p>
            </div>
            <div className="grow wide:hidden" />
            <div id={IDS.start} className="flex scroll-mt-4 flex-col gap-2.5 px-4 pb-6 wide:mt-2 wide:gap-[18px] wide:p-0">
              {heroCard}
              {facts && (
                <span className="text-center text-[13px] font-medium text-ink-900 wide:pl-1 wide:text-left wide:text-[14px] wide:font-normal wide:text-ink-700">
                  {copy.calm_hero_facts}
                </span>
              )}
            </div>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-[linear-gradient(180deg,rgba(234,241,248,0)_0%,#EAF1F8_100%)] wide:h-[180px]" />
      </header>

      {sections}
    </div>
  );
}
