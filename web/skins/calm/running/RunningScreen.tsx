import type { RunningScreenProps } from "../flow/contracts";
import { Wordmark } from "../parts";

/**
 * The sky photo with the running card (or an error card) on it. On a phone the
 * card sits at the bottom; above 860 px it sits where the landing form is, so
 * the page does not jump when a run starts.
 */
export function RunningScreen({ children, note }: RunningScreenProps) {
  return (
    <div className="sky-hero relative flex min-h-svh flex-col text-ink-900 wide:min-h-[max(820px,100svh)]">
      {/* The wash that softens the photo towards the card (phone only). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 wide:hidden"
        style={{ background: "linear-gradient(180deg, rgba(234,241,248,0) 30%, rgba(234,241,248,.55) 100%)" }}
      />
      {note ? <div className="relative">{note}</div> : null}
      {/* White on the dark phone photo, so focus rings are white here. */}
      <nav className="on-dark relative px-5 py-4 wide:px-[clamp(20px,4vw,56px)] wide:py-6">
        <Wordmark light className="text-[26px] wide:text-[30px] wide:text-ink-900" />
      </nav>
      <div className="relative flex flex-1 flex-col justify-end px-4 pb-6 wide:mx-auto wide:grid wide:w-full wide:max-w-[1360px] wide:grid-cols-[minmax(0,1fr)_minmax(0,540px)] wide:items-center wide:gap-10 wide:px-[clamp(20px,5vw,72px)] wide:pb-[120px]">
        <div aria-hidden className="hidden wide:block" />
        <div>{children}</div>
      </div>
    </div>
  );
}
