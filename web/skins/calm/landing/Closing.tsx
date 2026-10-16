import Link from "next/link";
import { copy } from "@/lib/copy";
import { Wordmark } from "../parts";
import { StartLink } from "./StartLink";

/** The sunset photo with the call to act again, and the footer on top of it. */
export function Closing() {
  return (
    <section className="closing on-dark">
      {/* Decorative, so no alt text. Loaded only as it nears the screen. A plain
          img: next/image would add a loader for a file that is already WebP. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hero/closing.webp" alt="" width={1672} height={941} loading="lazy" decoding="async" aria-hidden className="closing-photo" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[110px] bg-[linear-gradient(180deg,#5F89C0_0%,rgba(95,137,192,0)_100%)] wide:h-[120px]" />
      {/* Phone: the star is at 80vw, 166px. */}
      <span aria-hidden className="twinkle absolute top-[166px] left-[80vw] h-[34px] w-[34px] wide:hidden" />
      {/* Wide: percent positions match the photo only when the box has its ratio. */}
      <span aria-hidden className="twinkle absolute top-[18.49%] left-[87.14%] hidden h-[38px] w-[38px] min-[1141px]:block" />
      <div className="relative mx-auto box-border flex w-full max-w-[900px] flex-col items-start gap-3.5 px-5 pt-[236px] pb-6 wide:items-center wide:gap-[18px] wide:px-[clamp(20px,4vw,40px)] wide:pt-[9%] wide:pb-0 wide:text-center">
        <h2 className="m-0 font-serif text-[46px] leading-none font-normal text-white [text-shadow:0_2px_18px_rgba(11,35,64,0.45)] wide:text-[clamp(44px,5.4vw,76px)] wide:tracking-[-1px] wide:[text-shadow:0_2px_18px_rgba(11,35,64,0.35)]">
          {copy.calm_home_closing_title_1}
          <br />
          <span className="italic">{copy.calm_home_closing_title_2}</span>
        </h2>
        <p className="m-0 text-[16px] font-medium text-white [text-shadow:0_1px_10px_rgba(11,35,64,0.55)] wide:text-[19px] wide:font-normal wide:[text-shadow:0_1px_10px_rgba(11,35,64,0.4)]">
          {copy.calm_home_closing_lead}
        </p>
        <StartLink className="glass lift mt-1.5 inline-flex min-h-11 items-center rounded-full px-[22px] py-3.5 text-[16px] font-bold text-ink-900 no-underline [background:rgb(255_255_255/0.6)] wide:mt-2 wide:px-[26px] wide:py-[15px]">
          {copy.calm_home_closing_cta}
        </StartLink>
      </div>
      <footer className="glass relative mx-4 mb-5 box-border flex items-center justify-between gap-3 rounded-[20px] px-[18px] py-3.5 wide:mx-auto wide:mb-6 wide:w-[calc(100%-48px)] wide:max-w-[1152px] wide:flex-wrap wide:gap-x-6 wide:gap-y-3 wide:rounded-[22px] wide:px-6 wide:py-4">
        <Wordmark className="text-[22px] wide:text-[24px]" />
        <div className="flex gap-4 text-[14px] font-medium wide:gap-[22px] wide:text-[15px]">
          <Link href="/privacy" className="inline-flex min-h-11 items-center underline">
            {copy.calm_footer_privacy}
          </Link>
          <a href="https://shanthanu.vercel.app" className="inline-flex min-h-11 items-center text-ink-700 no-underline hover:underline">
            {copy.calm_footer_made_by}
          </a>
        </div>
      </footer>
    </section>
  );
}
