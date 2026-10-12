import type { Metadata } from "next";
import { GITHUB_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What is sent, to whom, and what is kept. In plain words.",
};

// Each statement here describes what the code does today. If the code changes
// (analytics, a new host, a new model provider), this page must change with it.
const SECTIONS = [
  {
    title: "What we keep",
    body: [
      "Nothing. Your resume and the job description are processed in memory and gone when the run ends. There is no database and no account.",
      "If you upload a PDF, it is written to a temporary file so the text can be read, and that file is deleted straight away.",
      "Your result lives in your browser tab. Close or reload the tab and it is gone.",
    ],
  },
  {
    title: "What is sent to the AI model",
    body: [
      "The text of your resume and the job description is sent to Google's Gemini API, which does the reading and rewriting.",
      "Before that, we replace your email address, phone number and web links with placeholders, so the model never sees them. They are put back only in the result shown to you.",
      "Your name and anything else written in the resume text, such as a city, employers and schools, is sent as part of the text.",
      "We use the paid Gemini API. Google's terms for the paid API say it does not use that content to improve its products. Google may keep it for a limited time to detect abuse.",
    ],
  },
  {
    title: "What our logs hold",
    body: [
      "For each run: how long it took, how many steps and tokens it used, what it cost us, and how many changes it proposed. No resume text, no job text.",
      "To enforce the daily limit we count runs per IP address. The count is kept in memory under a scrambled form of the address and is cleared every day.",
    ],
  },
  {
    title: "Other companies involved",
    body: [
      "Hosting: the website is served by Vercel and the agent runs on Hugging Face Spaces. Like any host, they see your IP address and the requests you make.",
      "Bot check: before a run, Cloudflare Turnstile checks that you are a person. Cloudflare sees your IP address and some browser details to do that.",
      "We set no cookies of our own and run no advertising trackers on this site.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Privacy</h1>
      <p className="mt-3 text-muted">
        {SITE_NAME} was built so that you can check what it does. That includes what it does with
        your data.
      </p>
      {SECTIONS.map((section) => (
        <section key={section.title} className="mt-10">
          <h2 className="font-serif text-2xl font-semibold">{section.title}</h2>
          <ul className="mt-3 space-y-3">
            {section.body.map((line) => (
              <li key={line} className="border-l-2 border-rule pl-3">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-10 text-sm text-muted">
        The code that does all of this is public.{" "}
        <a href={GITHUB_URL} className="text-accent underline underline-offset-4">
          Read it on GitHub
        </a>
        .
      </p>
    </div>
  );
}
