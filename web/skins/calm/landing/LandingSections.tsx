import { Cloud } from "../parts";
import { Closing } from "./Closing";
import { Example } from "./Example";
import { Faq } from "./Faq";
import { Missing, PrivacyStrip, Steps } from "./Sections";

/**
 * Everything under the hero: the day sky with the example, the steps, what's
 * missing, privacy and the questions, then the closing. Drawn on the server:
 * only the parts that respond to a tap (the example's lines, the questions,
 * the buttons) are sent to the browser as code.
 */
export function LandingSections() {
  return (
    <>
      <div className="day relative overflow-hidden">
        {/* Clouds: they drift on wide screens and stand still on phones. */}
        <Cloud className="drift hidden wide:block" style={{ width: 520, height: 220, left: -120, top: 140, opacity: 0.8 }} />
        <Cloud className="drift2 hidden wide:block" style={{ width: 640, height: 260, right: -160, top: 980, opacity: 0.75 }} />
        <Cloud className="drift hidden wide:block" style={{ width: 480, height: 200, left: "8%", top: 1900, opacity: 0.7 }} />
        <Cloud className="drift2 hidden wide:block" style={{ width: 560, height: 220, right: "4%", top: 2650, opacity: 0.7 }} />
        <Cloud className="wide:hidden" style={{ width: 360, height: 160, left: -140, top: 120, opacity: 0.8 }} />
        <Cloud className="wide:hidden" style={{ width: 380, height: 170, right: -160, top: 1200, opacity: 0.75 }} />
        <Cloud className="wide:hidden" style={{ width: 340, height: 150, left: -120, top: 2300, opacity: 0.7 }} />
        {/* The contrail from the plane in the hero down to the star (wide only). */}
        <svg
          aria-hidden
          viewBox="0 0 100 1000"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 hidden h-full w-full [filter:drop-shadow(0_1px_1px_rgba(16,44,80,0.18))] wide:block"
        >
          <path
            d="M 21 0 C 40 90, 92 140, 86 260 S 12 420, 16 560 S 90 760, 82 1000"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeDasharray="7 11"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity=".95"
          />
        </svg>
        <Example />
        <Steps />
        <Missing />
        <PrivacyStrip />
        <Faq />
      </div>
      <Closing />
    </>
  );
}
