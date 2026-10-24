import type { Metadata } from "next";
import { Glass } from "@/skins/calm/parts";
import { PageFrame } from "@/skins/calm/pages/PageFrame";
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
    <PageFrame wide>
      <Glass className="rounded-[28px] p-6 wide:p-8">
        <h1 className="font-serif text-[38px] leading-[1.1] text-ink-900 wide:text-[46px]">
          {copy.calm_privacy_title}
        </h1>
        <div className="mt-4 text-[17px] leading-[1.6] text-ink-700">
          <p>{copy.privacy_lead}</p>
          {SECTIONS.map((s) => (
            <section key={s.title} className="mt-8">
              <h2 className="font-serif text-[26px] leading-tight text-ink-900">{s.title}</h2>
              <ul className="mt-3 list-disc space-y-3 pl-5 marker:text-ink-500">
                {s.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
          <p className="mt-8">
            {copy.privacy_code}{" "}
            <a href={GITHUB_URL} className="font-semibold text-ink-900 underline underline-offset-2">
              {copy.privacy_code_link}
            </a>
          </p>
        </div>
      </Glass>
    </PageFrame>
  );
}
