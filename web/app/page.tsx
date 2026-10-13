import { HeroDemo } from "@/components/HeroDemo";
import { HowItWorks } from "@/components/HowItWorks";
import { SiteLink } from "@/components/SiteLink";
import { StartHere } from "@/components/StartHere";
import { chapter, halfLeft, halfRight, page, plus, primaryButton, quietLink } from "@/components/ui";
import { EVAL_URL } from "@/lib/config";
import { copy } from "@/lib/copy";
import { EXAMPLE_RUN } from "@/lib/example";
import { gaps } from "@/lib/resume";

// The home page is a row of chapters. Each chapter is one flat field of
// colour, edge to edge, and holds one idea; the colour says what the chapter
// is about (DESIGN.md lists what each colour means). The page shows the
// product working and says very little: under 150 visible words, not counting
// the FAQ (scripts/copy.mjs enforces that).

// Each tile: what it says when closed, and the paragraphs it opens to. The
// first one is the longer account of how a run works.
const FAQ: [string, string[]][] = [
  [copy.home_how_toggle, [copy.home_more_how_1, copy.home_more_how_2, copy.home_more_how_3]],
  [copy.faq_1_q, [copy.faq_1_a]],
  [copy.faq_2_q, [copy.faq_2_a]],
  [copy.faq_3_q, [copy.faq_3_a]],
  [copy.faq_4_q, [copy.faq_4_a]],
  [copy.faq_5_q, [copy.faq_5_a]],
];

// What the job in the recorded run asked for and the example resume did not
// show. The run left every one of them out. Here they are, as one long line.
const LEFT_OUT = gaps(EXAMPLE_RUN.result).map((req) => req.text);
const LEFT_OUT_LINE = LEFT_OUT.map((name) => `${name} ● `).join("");

export default function HomePage() {
  return (
    <>
      {/* --- Black: the headline in two inks, one line, the main button. --- */}
      <section className="field-ground">
        {/* The field is kept shorter than the screen on purpose: the white
            chapter below, where the product runs, starts on the first screen. */}
        <div className={`${page} relative flex flex-col pb-8 lg:min-h-[calc(76svh-4.25rem)] lg:pb-10`}>
          {/* A real picture of what comes out: the top of the recorded run's
              PDF, rising from the white chapter below. Wide screens only: a
              phone has no room for it, and (being lazy and hidden there) never
              downloads it. */}
          <div className="absolute bottom-0 left-10 hidden h-52 w-[33rem] overflow-hidden lg:block">
            {/* A plain img: the file is already small, and next/image would add a
                script-driven loader for no gain. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/example-pdf-top.webp" alt={copy.pdf_preview_alt} width={1040} height={587} loading="lazy" className="w-full" />
          </div>
          <div className="headline-box pt-6 lg:pt-[5svh]">
            {/* Two sentences, one per line. The second is lemon, the colour of
                a changed word: the break reads as a change of voice. Each line
                rises from behind its own baseline on load. */}
            <h1 className="headline">
              <span className="line">
                <span>{copy.home_title_1}</span>
              </span>{" "}
              <span className="line text-changed">
                <span>{copy.home_title_2}</span>
              </span>
            </h1>
          </div>
          <div className="enter mt-auto pt-8 lg:ml-auto lg:w-[26rem]" style={{ "--i": 4 } as React.CSSProperties}>
            <p className="lead">{copy.home_lead}</p>
            <SiteLink href="/try" className={`${primaryButton} mt-6 w-full`}>
              {copy.home_cta}
            </SiteLink>
            <p className="small mt-3 text-muted">{copy.home_facts}</p>
          </div>
        </div>
      </section>

      {/* --- White: the resume, with the recorded run playing on it. --- */}
      <HeroDemo />

      {/* --- Cornflower and black: how it works, driven by a slider. --- */}
      <HowItWorks />

      {/* --- Orange: what the recorded run refused to add. Proof, not a claim. --- */}
      <section aria-label={copy.gaps_title}>
        {/* The moving line is a picture of the names: CSS draws it (twice, for
            the loop) from data-names. Screen readers get the plain list in
            aria-label instead, once. */}
        <div role="img" aria-label={LEFT_OUT.join(", ")} className="field-left-out overflow-hidden">
          <p
            data-names={LEFT_OUT_LINE}
            className="band whitespace-pre py-[0.32em] text-[15vw] font-bold uppercase leading-none tracking-[-0.03em] sm:text-[8vw]"
          />
        </div>
        <div className={`${page} py-10`}>
          <p className="lead max-w-[36ch]">{copy.gaps_text}</p>
        </div>
      </section>

      {/* --- Black and mint: two honest lines. Does it work, and privacy. --- */}
      <div className="grid lg:grid-cols-2">
        <section aria-labelledby="proof" className={`field-ground ${halfLeft} ${chapter}`}>
          <div className="arrive">
            <h2 id="proof" className="head">
              {copy.home_proof_title}
            </h2>
            <p className="lead mt-6 max-w-[30ch]">{copy.home_proof_text}</p>
            <a href={EVAL_URL} className={`${quietLink} mt-4`}>
              {copy.home_proof_link}
            </a>
          </div>
        </section>
        <section aria-labelledby="privacy" className={`field-yours ${halfRight} ${chapter}`}>
          <div className="arrive">
            <h2 id="privacy" className="head">
              {copy.home_privacy_title}
            </h2>
            <p className="lead mt-6 max-w-[30ch]">{copy.home_privacy_text}</p>
            <SiteLink href="/privacy" className={`${quietLink} mt-4`}>
              {copy.home_privacy_link}
            </SiteLink>
          </div>
        </section>
      </div>

      {/* --- Black: the questions, as filled tiles. The open one turns cyan. --- */}
      <section aria-labelledby="faq" className="field-ground">
        <div className={`${page} ${chapter} grid gap-x-10 gap-y-8 lg:grid-cols-12`}>
          <h2 id="faq" className="head self-start lg:sticky lg:top-10 lg:col-span-4">
            {copy.home_faq_title}
          </h2>
          <div className="arrive space-y-2 lg:col-span-8">
            {FAQ.map(([question, answers]) => (
              // details/summary is a built-in toggle: no JavaScript is needed.
              // The shared name makes the browser close one when another opens.
              <details
                key={question}
                name="faq"
                className="group field-tile open:bg-action open:text-black open:[--ring:#000000]"
              >
                <summary className="flex min-h-18 items-center justify-between gap-4 px-5 py-4 text-[1.25rem] font-medium leading-tight sm:px-6">
                  {question}
                  <span aria-hidden className={plus} />
                </summary>
                <div className="max-w-[52ch] space-y-3 px-5 pb-6 sm:px-6">
                  {answers.map((answer) => (
                    <p key={answer}>{answer}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* --- Cyan: the first step of the flow, already open. --- */}
      <section aria-labelledby="end" className="field-action">
        <div className={`${page} ${chapter} grid min-h-[80svh] gap-10 lg:grid-cols-12`}>
          <h2 id="end" className="head text-[clamp(2.75rem,7vw,7rem)] lg:col-span-7 lg:self-end">
            {copy.home_end_title}
          </h2>
          <div className="self-end lg:col-span-5 lg:col-start-8">
            <StartHere />
          </div>
        </div>
      </section>
    </>
  );
}
