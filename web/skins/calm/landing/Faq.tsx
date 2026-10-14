import { copy } from "@/lib/copy";
import { Glass } from "../parts";
import { Disclosure } from "./Disclosure";
import { H2 } from "./Sections";

const FAQ = [
  { q: copy.calm_faq_1_q, a: copy.calm_faq_1_a },
  { q: copy.calm_faq_2_q, a: copy.calm_faq_2_a },
  { q: copy.calm_faq_3_q, a: copy.calm_faq_3_a },
  { q: copy.calm_faq_4_q, a: copy.calm_faq_4_a },
];

/** Questions as an accordion. The first starts open; several can be open. */
export function Faq() {
  return (
    <section className="relative mx-auto box-border max-w-[860px] px-5 pt-10 pb-16 wide:px-[clamp(20px,4vw,40px)] wide:pt-20 wide:pb-[120px]">
      <h2 className={`${H2} mb-2.5 wide:mb-7`}>{copy.calm_faq_title}</h2>
      <div className="flex flex-col gap-2.5 wide:gap-3">
        {FAQ.map((item, i) => (
          <Glass key={item.q} className="rounded-[20px] wide:rounded-[22px]">
            <Disclosure
              heading
              chevron
              startOpen={i === 0}
              label={item.q}
              buttonClassName="flex min-h-11 w-full items-center justify-between gap-3 border-0 bg-transparent px-5 py-[18px] text-left font-sans text-[16px] font-semibold text-ink-900 wide:gap-4 wide:px-6 wide:py-5 wide:text-[17px]"
              panel={<p className="m-0 px-5 pb-[18px] text-[15px] leading-[1.55] text-ink-700 wide:px-6 wide:pb-[22px] wide:text-[16px]">{item.a}</p>}
            />
          </Glass>
        ))}
      </div>
    </section>
  );
}
