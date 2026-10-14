import type { Metadata } from "next";
import { page, inlineLink, pageTop } from "@/skins/calm/ui";
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
      <header className={`bg-mist ${pageTop}`}>
        <div className={`${page} pb-14 sm:pb-20`}>
          <h1 className="t-title">{copy.privacy_title}</h1>
          <p className="t-lead mt-5 max-w-[46ch] text-ink-soft">{copy.privacy_lead}</p>
        </div>
      </header>
      <div className={`${page} py-14 sm:py-20`}>
        <div className="max-w-[62ch] space-y-14">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="t-heading">{s.title}</h2>
              <ul className="t-body mt-4 space-y-4 text-ink-soft">
                {s.points.map((point) => (
                  <li key={point} className="relative pl-5 before:absolute before:left-0 before:top-[0.72em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-sky">
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="t-body">
            {copy.privacy_code}{" "}
            <a href={GITHUB_URL} className={`${inlineLink} font-medium`}>
              {copy.privacy_code_link}
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
