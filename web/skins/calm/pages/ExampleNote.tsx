import { SiteLink } from "@/components/SiteLink";
import { Glass } from "@/skins/calm/parts";
import { copy } from "@/lib/copy";

/**
 * The note at the top of the recorded run: says the run is made up and links
 * to the form on the home page. It sits over the sky photo and over the result.
 */
export function ExampleNote() {
  return (
    <Glass
      tone="photo"
      className="mx-4 max-w-[540px] rounded-[20px] px-4 py-3 text-[15px] leading-snug text-ink-900 wide:mx-auto"
    >
      <p>
        {copy.calm_example_note}{" "}
        <SiteLink
          href="/#start"
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
        >
          {copy.calm_example_link}
        </SiteLink>
      </p>
    </Glass>
  );
}
