import type { LandingProps } from "../flow/contracts";

/** The landing page: the hero with its card, then the sections. */
export function Landing({ heroCard }: LandingProps) {
  return <div>{heroCard}</div>;
}
