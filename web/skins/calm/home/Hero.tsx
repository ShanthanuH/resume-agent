import { copy } from "@/lib/copy";
import { SkyPhoto } from "../primitives";
import { page } from "../ui";
import { HeroCard } from "./HeroCard";

/** The photo, one line, and the box the resume goes into. */
export function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-sky-wash sm:min-h-[44rem]">
      <SkyPhoto />
      <div
        className={`${page} relative grid items-start gap-8 pb-12 pt-28 sm:pt-32 lg:min-h-[100svh] lg:grid-cols-2 lg:content-center lg:gap-x-16 lg:gap-y-8 lg:pb-16`}
      >
        <div className="sky-scrim rise lg:col-start-2">
          <h1 className="t-display text-white">{copy.calm_hero_title}</h1>
          <p className="t-lead mt-4 max-w-[34ch] text-white">{copy.calm_hero_sub}</p>
        </div>
        <div className="rise rise-2 mx-auto w-full max-w-[28rem] lg:col-start-2 lg:mx-0">
          <HeroCard />
        </div>
      </div>
    </section>
  );
}
