import { HeroDemo } from "@/components/HeroDemo";
import { SiteLink } from "@/components/SiteLink";
import { accentButton, page, primaryButton, quietLink } from "@/components/ui";
import { EVAL_URL } from "@/lib/config";
import { copy } from "@/lib/copy";

// The home page shows the product working and says very little: under 150
// visible words, not counting the FAQ (scripts/copy.mjs enforces that). Every
// section has one idea, in one or two short lines, and the same shape:
// a small label or heading, a line, a link.

const STEPS = [copy.home_how_1, copy.home_how_2, copy.home_how_3];
const DETAILS = [copy.home_more_how_1, copy.home_more_how_2, copy.home_more_how_3];
const FAQ = [
  [copy.faq_1_q, copy.faq_1_a],
  [copy.faq_2_q, copy.faq_2_a],
  [copy.faq_3_q, copy.faq_3_a],
  [copy.faq_4_q, copy.faq_4_a],
  [copy.faq_5_q, copy.faq_5_a],
];

// The heading every section below the hero shares.
const sectionTitle = "display text-[1.75rem] sm:text-[2.25rem]";
// A toggle row: the question or label on the left, a plus that turns into a
// minus on the right. "group-open" is true while the <details> is open.
const toggleRow = "flex min-h-12 items-center justify-between gap-4 py-3 font-medium";
const plus =
  "relative h-3 w-3 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-ink " +
  "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-ink after:transition-transform after:duration-200 " +
  "after:ease-swoosh group-open:after:scale-y-0";

export default function HomePage() {
  return (
    <div className={page}>
      {/* --- Hero: headline, one line, the main button, and the product. --- */}
      <section className="grid gap-10 pb-16 pt-8 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,31rem)] lg:items-center lg:gap-14 lg:pb-24">
        <div>
          <h1 className="display text-[2.6rem] sm:text-[3.5rem] lg:text-[4rem]">
            {/* The second sentence sits on its own line: two short sentences, one shape. */}
            {copy.home_title_1}{" "}
            <em className="block">
              {/* The highlighter stroke under these words is drawn in on load. */}
              <span className="stroke">{copy.home_title_2}</span>
            </em>
          </h1>
          <p className="mt-5 max-w-md text-lg text-soft sm:text-xl">{copy.home_lead}</p>
          <div className="mt-8 flex flex-col gap-x-5 gap-y-3 sm:flex-row sm:items-center">
            <SiteLink href="/try" className={primaryButton}>
              {copy.home_cta}
            </SiteLink>
            <p className="text-sm text-muted">{copy.home_facts}</p>
          </div>
        </div>
        <HeroDemo />
      </section>

      {/* --- How it works: three steps, details behind a toggle. --- */}
      <section aria-labelledby="how" className="border-t border-rule py-14 sm:py-20">
        <h2 id="how" className="label">
          {copy.home_how_title}
        </h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-10">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-baseline gap-4 sm:block">
              <span aria-hidden className="display text-[2.5rem] italic text-ink/40 sm:text-[3.5rem]">
                {index + 1}
              </span>
              <p className={`${sectionTitle} sm:mt-2`}>{step}</p>
            </li>
          ))}
        </ol>
        <details className="group mt-8 max-w-2xl border-y border-rule">
          <summary className={toggleRow}>
            {copy.home_how_toggle}
            <span aria-hidden className={plus} />
          </summary>
          <div className="space-y-3 pb-5 text-soft">
            {DETAILS.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </details>
      </section>

      {/* --- Two honest lines, side by side: does it work, and privacy. --- */}
      <div className="grid border-t border-rule sm:grid-cols-2">
        <section aria-labelledby="proof" className="py-14 sm:py-20 sm:pr-10">
          <h2 id="proof" className={sectionTitle}>
            {copy.home_proof_title}
          </h2>
          <p className="mt-3 max-w-sm text-lg text-soft">{copy.home_proof_text}</p>
          <a href={EVAL_URL} className={`${quietLink} mt-2 font-medium`}>
            {copy.home_proof_link}
          </a>
        </section>
        <section
          aria-labelledby="privacy"
          className="border-t border-rule py-14 sm:border-l sm:border-t-0 sm:py-20 sm:pl-10"
        >
          <h2 id="privacy" className={sectionTitle}>
            {copy.home_privacy_title}
          </h2>
          <p className="mt-3 max-w-sm text-lg text-soft">{copy.home_privacy_text}</p>
          <SiteLink href="/privacy" className={`${quietLink} mt-2 font-medium`}>
            {copy.home_privacy_link}
          </SiteLink>
        </section>
      </div>

      {/* --- FAQ: five at most, closed to begin with. --- */}
      <section aria-labelledby="faq" className="border-t border-rule py-14 sm:py-20">
        <h2 id="faq" className="label">
          {copy.home_faq_title}
        </h2>
        <div className="mt-4 max-w-2xl divide-y divide-rule border-y border-rule">
          {FAQ.map(([question, answer]) => (
            // details/summary is a built-in toggle: no JavaScript is needed.
            <details key={question} className="group">
              <summary className={toggleRow}>
                {question}
                <span aria-hidden className={plus} />
              </summary>
              <p className="pb-5 pr-8 text-soft">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* --- The same main button once more, for those who read to the end. --- */}
      {/* It is the one dark panel on the page, so the eye ends up on it. */}
      <section
        aria-labelledby="end"
        className="on-ink flex flex-col items-start justify-between gap-6 rounded-3xl bg-ink px-6 py-12 text-paper sm:flex-row sm:items-center sm:px-12 sm:py-16"
      >
        <h2 id="end" className="display text-[2rem] sm:text-[2.75rem]">
          {copy.home_end_title}
        </h2>
        <SiteLink href="/try" className={`${accentButton} shrink-0`}>
          {copy.home_cta}
        </SiteLink>
      </section>
    </div>
  );
}
