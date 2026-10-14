"use client";

import { copy } from "@/lib/copy";
import type { LandingProps } from "../flow/contracts";
import { IDS } from "../flow/contracts";
import { Cloud } from "../parts";
import { Wordmark } from "../parts";
import { Closing } from "./Closing";
import { Example } from "./Example";
import { Faq, Missing, PrivacyStrip, Steps } from "./Sections";

/** Scroll to an element, smoothly unless the visitor asked for less motion. */
function scrollTo(id: string, block: ScrollLogicalPosition) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block });
}

/** Scroll to the form and put the cursor in the drop area, if it is on screen. */
function goToForm() {
  scrollTo(IDS.start, "center");
  document.getElementById(IDS.drop)?.focus({ preventScroll: true });
}

const NAV_BUTTON = "inline-flex min-h-11 items-center rounded-full text-[14px] font-semibold no-underline wide:text-[15px]";

/** The landing page: the hero with its card, then the sections. */
export function Landing({ heroCard, sections, facts }: LandingProps) {
  return (
    <div className="bg-page font-sans text-ink-900">
      <header className="sky-hero hero-dark relative box-border flex min-h-svh flex-col wide:min-h-[820px]">
        {/* Phone: a dark top, so the white wordmark and title can be read. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[300px] bg-[linear-gradient(180deg,rgba(11,35,64,0.28)_0%,rgba(11,35,64,0)_100%)] wide:hidden" />
        <nav className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-4 wide:px-[clamp(20px,4vw,56px)] wide:py-6">
          <Wordmark light className="text-[26px] wide:text-ink-900 wide:text-[30px]" />
          <div className="flex flex-wrap items-center gap-2.5">
            {sections && (
              <a
                href={`#${IDS.how}`}
                onClick={(event) => {
                  event.preventDefault();
                  scrollTo(IDS.how, "start");
                }}
                className={`${NAV_BUTTON} glass lift px-4 py-3 text-ink-900 wide:px-5 wide:py-[11px]`}
              >
                {copy.calm_nav_how}
              </a>
            )}
            <a
              href={`#${IDS.start}`}
              onClick={(event) => {
                event.preventDefault();
                goToForm();
              }}
              className={`${NAV_BUTTON} ink px-5 py-[11px] max-wide:hidden`}
            >
              {copy.calm_nav_start}
            </a>
          </div>
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

      {sections && (
        <>
          <div className="day relative overflow-hidden">
            {/* Clouds: they drift on wide screens and stand still on phones. */}
            <Cloud className="drift hidden wide:block" style={{ width: 520, height: 220, left: -120, top: 140, opacity: 0.8 }} />
            <Cloud className="drift2 hidden wide:block" style={{ width: 640, height: 260, right: -160, top: 980, opacity: 0.75 }} />
            <Cloud className="drift hidden wide:block" style={{ width: 480, height: 200, left: "8%", top: 1900, opacity: 0.7 }} />
            <Cloud className="drift2 hidden wide:block" style={{ width: 560, height: 220, right: "4%", top: 2650, opacity: 0.7 }} />
            <Cloud className="wide:hidden" style={{ width: 360, height: 160, left: -140, top: 120, opacity: 0.8 }} />
            <Cloud className="wide:hidden" style={{ width: 380, height: 170, right: -160, top: 1200, opacity: 0.75 }} />
            <Cloud className="wide:hidden" style={{ width: 340, height: 150, left: -120, top: 2300, opacity: 0.7 }} />
            {/* The contrail from the plane in the hero down to the star (wide only). */}
            <svg
              aria-hidden
              viewBox="0 0 100 1000"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 hidden h-full w-full [filter:drop-shadow(0_1px_1px_rgba(16,44,80,0.18))] wide:block"
            >
              <path
                d="M 21 0 C 40 90, 92 140, 86 260 S 12 420, 16 560 S 90 760, 82 1000"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeDasharray="7 11"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity=".95"
              />
            </svg>
            <Example />
            <Steps />
            <Missing />
            <PrivacyStrip />
            <Faq />
          </div>
          <Closing onStart={goToForm} />
        </>
      )}
    </div>
  );
}
