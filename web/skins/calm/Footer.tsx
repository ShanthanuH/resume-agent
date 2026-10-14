import { SiteLink } from "@/components/SiteLink";
import { GITHUB_URL } from "@/lib/config";
import { copy } from "@/lib/copy";
import { page, textLink } from "./ui";

export function Footer() {
  return (
    <footer className="bg-paper">
      <div className={`${page} t-small flex flex-col gap-4 border-t border-line py-8 text-ink-soft sm:flex-row sm:items-center sm:justify-between`}>
        <span className="font-semibold text-ink">{copy.nav_brand}</span>
        <nav className="flex flex-wrap gap-x-6">
          <SiteLink href="/example" className={textLink}>
            {copy.footer_example}
          </SiteLink>
          <SiteLink href="/privacy" className={textLink}>
            {copy.footer_privacy}
          </SiteLink>
          <a href={GITHUB_URL} className={textLink}>
            {copy.footer_github}
          </a>
        </nav>
      </div>
    </footer>
  );
}
