import type { Metadata } from "next";
import { page, quietLink } from "@/components/ui";
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
    <div className={`${page} pt-6 sm:pt-12`}>
      <div className="max-w-2xl">
        <h1 className="display text-[2.6rem] sm:text-[3.5rem]">{copy.privacy_title}</h1>
        <p className="mt-4 text-lg text-soft sm:text-xl">{copy.privacy_lead}</p>
        {SECTIONS.map((section) => (
          <section key={section.title} className="mt-12 border-t border-rule pt-8">
            <h2 className="display text-[1.75rem]">{section.title}</h2>
            <ul className="mt-4 space-y-4">
              {section.points.map((point) => (
                <li key={point} className="text-soft">
                  {point}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="mt-12 border-t border-rule pt-6 text-soft">
          {copy.privacy_code}{" "}
          <a href={GITHUB_URL} className={`${quietLink} font-medium text-ink`}>
            {copy.privacy_code_link}
          </a>
        </p>
      </div>
    </div>
  );
}
