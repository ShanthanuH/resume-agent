import type { Metadata } from "next";
import { chapter, page, quietLink } from "@/skins/bold/ui";
import { GITHUB_URL } from "@/lib/config";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.privacy_meta_title,
  description: copy.privacy_meta_description,
};

// Each statement on this page describes what the code does today. If the code
// changes (analytics, a new host, a new model provider), the words in
// content/copy.yaml must change with it.
const SECTIONS = [
  { title: copy.privacy_keep_title, points: [copy.privacy_keep_1, copy.privacy_keep_2, copy.privacy_keep_3] },
  {
    title: copy.privacy_model_title,
    points: [copy.privacy_model_1, copy.privacy_model_2, copy.privacy_model_3, copy.privacy_model_4],
  },
  { title: copy.privacy_logs_title, points: [copy.privacy_logs_1, copy.privacy_logs_2] },
  {
    title: copy.privacy_others_title,
    points: [copy.privacy_others_1, copy.privacy_others_2, copy.privacy_others_3],
  },
];

export default function PrivacyPage() {
  return (
    <>
      {/* Mint is the site's colour for "what you wrote, what is yours". */}
      <section className="field-yours">
        <div className={`${page} flex min-h-[46svh] flex-col justify-end pb-10 pt-[var(--chapter)]`}>
          <h1 className="head text-[clamp(3.25rem,13vw,11rem)]">{copy.privacy_title}</h1>
          <p className="lead mt-6 max-w-[38ch]">{copy.privacy_lead}</p>
        </div>
      </section>
      {/* Each section: its title on the left, its points on the right. Space
          alone separates one from the next. */}
      <div className={`${page} ${chapter} space-y-[var(--chapter)]`}>
        {SECTIONS.map((section) => (
          <section key={section.title} className="arrive grid gap-x-10 gap-y-5 lg:grid-cols-12">
            <h2 className="statement lg:col-span-5">{section.title}</h2>
            <ul className="max-w-[62ch] space-y-5 lg:col-span-7">
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="lead">
          {copy.privacy_code}{" "}
          <a href={GITHUB_URL} className={`${quietLink} font-bold`}>
            {copy.privacy_code_link}
          </a>
        </p>
      </div>
    </>
  );
}
