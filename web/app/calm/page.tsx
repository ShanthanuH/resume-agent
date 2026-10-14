import { copy } from "@/lib/copy";
import { SkyPhoto } from "@/skins/calm/primitives";

// PLACEHOLDER: subagent A replaces this with the calm home page.
export default function HomePage() {
  return (
    <section className="relative min-h-[100svh]">
      <SkyPhoto />
      <h1 className="t-display relative pt-40 text-white">{copy.calm_hero_title}</h1>
      <p className="relative text-white">{copy.calm_hero_sub}</p>
      <p>{copy.calm_gaps_title}</p>
    </section>
  );
}
