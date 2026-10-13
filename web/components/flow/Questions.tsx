import { copy } from "@/lib/copy";

/**
 * One block for anything the run wanted to ask. A question means the resume
 * was unclear about a fact the job cares about. The run never guesses the
 * answer: it shows the question, and the visitor can put the answer into
 * their resume and run again.
 */
export function Questions({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;
  return (
    <section className="field-recorded p-5">
      <h2 className="lead font-bold">{questions.length === 1 ? copy.questions_title_one : copy.questions_title_many}</h2>
      <ul className="mt-2 space-y-2 font-medium">
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
      <p className="mt-3 max-w-[60ch]">{copy.questions_text}</p>
    </section>
  );
}
