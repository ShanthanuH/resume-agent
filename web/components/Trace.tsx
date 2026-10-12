import type { Step, StepKind } from "@/lib/types";

// The mark and colour for each kind of step. Shape as well as colour, so the
// meaning does not depend on seeing colour.
const MARK: Record<StepKind, { glyph: string; className: string }> = {
  ok: { glyph: "✓", className: "bg-accent text-white" },
  gap: { glyph: "∅", className: "border border-dashed border-ink text-ink" },
  bad: { glyph: "✕", className: "bg-reject text-white" },
  warn: { glyph: "!", className: "border border-reject text-reject" },
  info: { glyph: "·", className: "border border-rule text-muted" },
};

/** The agent's steps, one row each, in the order they happened. */
export function Trace({ steps, animate = false }: { steps: Step[]; animate?: boolean }) {
  return (
    <ol className="space-y-2">
      {steps.map((step) => {
        const mark = MARK[step.kind];
        // An agent turn is a heading for the tool calls under it.
        const isTurn = step.tool === "agent";
        return (
          <li key={step.n} className={`flex gap-3 ${animate ? "step-in" : ""} ${isTurn ? "pt-3" : ""}`}>
            <span
              aria-hidden
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs ${mark.className}`}
            >
              {mark.glyph}
            </span>
            <div className="min-w-0">
              <p className={`text-sm ${isTurn ? "font-mono text-xs uppercase tracking-wide text-muted" : "font-medium"} ${step.kind === "bad" ? "text-reject" : ""}`}>
                {step.title}
              </p>
              {step.detail && <p className="break-words text-sm text-muted">{step.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
