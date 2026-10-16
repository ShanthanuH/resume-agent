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
