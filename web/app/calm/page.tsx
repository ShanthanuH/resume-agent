import { Hero } from "@/skins/calm/home/Hero";
import { Closing, Faq, HowItWorks, LeftOut } from "@/skins/calm/home/Sections";
import { TraceDemo } from "@/skins/calm/home/TraceDemo";

// The calm home page: the photo with the upload box, the recorded run, what
// was left out, how it works, the questions, one last button.
export default function HomePage() {
  return (
    <>
      <Hero />
      <TraceDemo />
      <LeftOut />
      <HowItWorks />
      <Faq />
      <Closing />
    </>
  );
}
