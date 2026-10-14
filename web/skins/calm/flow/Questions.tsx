import { copy } from "@/lib/copy";
import { Card } from "../primitives";

/** Anything the run wanted to ask. It never guesses: it asks. */
export function Questions({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;
  return (
    <Card coreClassName="p-5">
      <section>
        <h2 className="t-heading">{questions.length === 1 ? copy.questions_title_one : copy.questions_title_many}</h2>
        <ul className="mt-2 space-y-2 font-medium">
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
        <p className="t-small mt-3 max-w-[60ch] text-ink-soft">{copy.questions_text}</p>
      </section>
    </Card>
  );
}
