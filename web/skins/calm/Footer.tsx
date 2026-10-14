import { SiteLink } from "@/components/SiteLink";
import { GITHUB_URL } from "@/lib/config";
import { copy } from "@/lib/copy";
import { inlineLink, page } from "./ui";

// PLACEHOLDER: subagent A replaces this with the real footer.
export function Footer() {
  return (
    <footer className={`${page} t-small flex flex-wrap gap-x-6 py-10 text-ink-soft`}>
      <SiteLink href="/example" className={inlineLink}>
        {copy.footer_example}
      </SiteLink>
      <SiteLink href="/privacy" className={inlineLink}>
        {copy.footer_privacy}
      </SiteLink>
      <a href={GITHUB_URL} className={inlineLink}>
        {copy.footer_github}
      </a>
    </footer>
  );
}
