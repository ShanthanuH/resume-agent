import { copy } from "@/lib/copy";

/**
 * One small card for anything the run wanted to ask. A question means the
 * resume was unclear about a fact the job cares about. The run never guesses
 * the answer: it shows the question, and the visitor can put the answer into
 * their resume and run again.
 */
export function Questions({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;
  return (
    <section className="rounded-md border border-rule bg-sheet p-4">
      <h2 className="label">{questions.length === 1 ? copy.questions_title_one : copy.questions_title_many}</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-soft">{copy.questions_text}</p>
    </section>
  );
}
