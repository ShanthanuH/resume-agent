import { SiteLink } from "@/components/SiteLink";
import { copy } from "@/lib/copy";
import { EXAMPLE_RUN } from "@/lib/example";
import { gaps } from "@/lib/resume";
import { ArrowDot, Strike } from "../primitives";
import { page, primaryButton, section } from "../ui";

/** The skills the recorded job asked for and the example resume lacks. */
export function LeftOut() {
  const names = gaps(EXAMPLE_RUN.result).map((req) => req.text);
  return (
    <section aria-labelledby="left-out" className="bg-cloud">
      <div className={`${page} ${section}`}>
        <h2 id="left-out" className="t-title max-w-[18ch]">
          {copy.calm_gaps_title}
        </h2>
        <ul className="arrive mt-10 flex flex-wrap gap-2.5">
          {names.map((name) => (
            <li key={name} className="t-body rounded-full bg-paper px-5 py-2.5 shadow-soft ring-1 ring-line">
              <Strike>{name}</Strike>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [copy.home_how_1, copy.home_how_2, copy.home_how_3];

export function HowItWorks() {
  return (
    <section aria-labelledby="how" className={`${page} ${section}`}>
      <h2 id="how" className="t-title">
        {copy.home_how_title}
      </h2>
      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step} className="arrive rounded-shell bg-mist p-7 ring-1 ring-line sm:p-9 md:min-h-56">
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-full bg-paper font-semibold tabular-nums text-sky-ink shadow-soft"
            >
              {index + 1}
            </span>
            <p className="t-heading mt-10 max-w-[14ch]">{step}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FAQ: [string, string[]][] = [
  [copy.home_how_toggle, [copy.home_more_how_1, copy.home_more_how_2, copy.home_more_how_3]],
  [copy.faq_1_q, [copy.faq_1_a]],
  [copy.faq_2_q, [copy.faq_2_a]],
  [copy.faq_3_q, [copy.faq_3_a]],
  [copy.faq_4_q, [copy.faq_4_a]],
  [copy.faq_5_q, [copy.faq_5_a]],
];

export function Faq() {
  return (
    <section aria-labelledby="faq" className="bg-mist">
      <div className={`${page} ${section} grid gap-10 lg:grid-cols-12`}>
        <h2 id="faq" className="t-title lg:col-span-4">
          {copy.home_faq_title}
        </h2>
        <div className="space-y-3 lg:col-span-8">
          {FAQ.map(([question, answers]) => (
            <details key={question} name="faq" className="group rounded-card bg-paper shadow-soft ring-1 ring-line">
              <summary className="flex min-h-16 list-none items-center justify-between gap-4 px-5 py-4 font-medium sm:px-7 [&::-webkit-details-marker]:hidden">
                {question}
                <svg
                  aria-hidden
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  className="shrink-0 text-ink-soft"
                >
                  <path d="M4 10h12" />
                  <path d="M10 4v12" className="origin-center transition-transform duration-[360ms] ease-calm group-open:scale-y-0" />
                </svg>
              </summary>
              <div className="t-body max-w-[62ch] space-y-3 px-5 pb-6 text-ink-soft sm:px-7">
                {answers.map((answer) => (
                  <p key={answer}>{answer}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section aria-labelledby="closing" className="bg-gradient-to-b from-paper to-sky-wash">
      <div className={`${page} ${section} text-center`}>
        <h2 id="closing" className="t-title mx-auto max-w-[16ch]">
          {copy.calm_home_closing_title}
        </h2>
        <SiteLink href="/try" className={`${primaryButton} mt-10`}>
          {copy.calm_home_closing_cta}
          <ArrowDot />
        </SiteLink>
      </div>
    </section>
  );
}
