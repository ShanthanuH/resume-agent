// Carries what the visitor gave on the home page over to the flow page.
//
// The home page has the flow's first step (bold skin) or its whole input card
// (calm skin) already open. Moving to the flow page inside the site does not
// reload the browser tab, so a value held here survives the move. The flow
// picks it up once when it opens. Nothing is stored or sent: after a reload
// this is empty again.

export type HandOver = {
  file?: File; // a chosen resume PDF
  resumeText?: string; // or a pasted resume
  jobText?: string; // the pasted job post
  /** True when the visitor pressed the button: the flow presses it for them. */
  start?: boolean;
};

let waiting: HandOver | null = null;

/** Called by the home page. A bare File is the same as { file }. */
export function handOver(value: File | HandOver): void {
  waiting = value instanceof File ? { file: value } : value;
}

/** Called by the flow when it opens. Returns the hand-over once, then forgets it. */
export function takeHandedOver(): HandOver | null {
  const value = waiting;
  waiting = null;
  return value;
}
