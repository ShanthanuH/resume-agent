"use client";

import { useState } from "react";
import { buildStateDemo } from "@/lib/state-demo";
import type { StateName } from "@/lib/states";
import { Flow } from "./flow/Flow";

/** The flow, opened in one named state. */
export function StateDemo({ name }: { name: StateName }) {
  // Built once: the flow must be handed the same starting state on every draw.
  const [demo] = useState(() => buildStateDemo(name));
  return <Flow {...demo} />;
}
