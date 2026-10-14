import Link from "next/link";
import { copy } from "@/lib/copy";
import { Glass, Struck } from "../parts";

export const SECTION = "relative mx-auto box-border max-w-[1200px] px-5 wide:px-[clamp(20px,4vw,40px)]";
export const H2 = "m-0 font-serif text-[40px] leading-[1.02] font-normal wide:text-[clamp(38px,4.4vw,60px)] wide:tracking-[-0.5px]";

const STEPS = [
  { title: copy.calm_home_step_1_title, text: copy.calm_home_step_1_text },
  { title: copy.calm_home_step_2_title, text: copy.calm_home_step_2_text },
  { title: copy.calm_home_step_3_title, text: copy.calm_home_step_3_text },
];

/** Three glass cards: one column on phones. */
export function Steps() {
  return (
    <section className={`${SECTION} py-10 wide:py-[70px]`}>
      <h2 className={`${H2} mb-2 wide:mb-0`}>{copy.calm_home_steps_title}</h2>
      <ol className="m-0 mt-3 grid list-none grid-cols-1 gap-3 p-0 wide:mt-8 wide:grid-cols-3 wide:gap-5">
        {STEPS.map((step, i) => (
          <li key={step.title} className="glass lift flex flex-col gap-1.5 rounded-3xl p-[22px] wide:gap-2.5 wide:rounded-[26px] wide:p-7">
            <span aria-hidden className="font-serif text-[38px] leading-none text-ink-700 italic wide:text-[44px]">
              {i + 1}
            </span>
            <h3 className="m-0 text-[18px] font-bold wide:text-[20px]">{step.title}</h3>
            <p className="m-0 text-[15px] leading-[1.55] text-ink-700 wide:text-[16px]">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The sample skills with a hand-drawn line through each. */
export function Missing() {
  const skills = copy.calm_home_missing_skills.split(", ");
  return (
    <section className={`${SECTION} flex flex-col gap-3 py-10 wide:grid wide:grid-cols-2 wide:items-center wide:gap-7 wide:py-[70px]`}>
      <div className="flex flex-col gap-3 wide:gap-3.5">
        <h2 className={H2}>{copy.calm_home_missing_title}</h2>
        <p className="m-0 max-w-[480px] text-[16px] leading-[1.55] text-ink-700 wide:text-[18px]">{copy.calm_home_missing_lead}</p>
      </div>
      <Glass className="mt-2.5 flex flex-col gap-3 rounded-[26px] px-6 py-[22px] wide:mt-0 wide:gap-3.5 wide:rounded-[30px] wide:px-[34px] wide:py-[30px]">
        <span className="text-[13px] font-semibold text-ink-500 wide:text-[14px]">{copy.calm_missing_label}</span>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-0.5 wide:gap-x-[30px] wide:gap-y-1">
          {skills.map((word, i) => (
            <Struck key={word} word={word} index={i} draw className="text-[38px] [--strike-h:2.5px] wide:text-[46px] wide:[--strike-h:3px]" />
          ))}
        </div>
        <span className="text-[13px] text-ink-700 wide:text-[14px]">{copy.calm_home_missing_note}</span>
      </Glass>
    </section>
  );
}

/** One glass strip: what happens to your data, and a link to the page. */
export function PrivacyStrip() {
  return (
    <section className={`${SECTION} py-6 wide:py-10`}>
      <Glass className="flex flex-col items-start gap-2.5 rounded-[26px] p-6 wide:flex-row wide:flex-wrap wide:items-center wide:justify-between wide:gap-x-10 wide:gap-y-[18px] wide:rounded-[30px] wide:px-9 wide:py-[30px]">
        <div className="flex max-w-[700px] flex-col gap-1.5">
          <h3 className="m-0 font-serif text-[30px] leading-[1.1] font-normal wide:text-[34px]">{copy.calm_home_privacy_title}</h3>
          <p className="m-0 text-[15px] leading-[1.55] text-ink-700 wide:text-[16px]">{copy.calm_home_privacy_text}</p>
        </div>
        <Link
          href="/privacy"
          className="glass lift mt-1 inline-flex min-h-11 items-center rounded-full px-4 py-[11px] text-[14px] font-semibold no-underline wide:mt-0 wide:px-5 wide:py-3 wide:text-[15px]"
        >
          {copy.calm_home_privacy_link}
        </Link>
      </Glass>
    </section>
  );
}
