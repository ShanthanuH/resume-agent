// Carries one chosen file from the home page to the flow page.
//
// The last chapter of the home page has the flow's first step already open: a
// box to drop or choose a resume. Moving to the flow page inside the site does
// not reload the browser tab, so a value held here survives the move. The flow
// picks the file up once when it opens. Nothing is stored or sent: after a
// reload this is empty again.

let waiting: File | null = null;

/** Called by the home page when a file is chosen there. */
export function handOver(file: File): void {
  waiting = file;
}

/** Called by the flow when it opens. Returns the file once, then forgets it. */
export function takeHandedOver(): File | null {
  const file = waiting;
  waiting = null;
  return file;
}
