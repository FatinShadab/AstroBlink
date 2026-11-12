"use client";

import Link from "next/link";
import { en } from "@/lib/i18n/en";
import { useT } from "@/lib/i18n/LangProvider";
import { Container } from "./Container";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/projects", key: "nav.projects" },
  { href: "/explore", key: "nav.explore" },
  { href: "/guide", key: "nav.guide" },
  { href: "/about", key: "nav.about" },
  { href: "/embed", key: "footer.embed" },
] as const;

/**
 * Footer (design Â§7.4): three columns on desktop, stacked on mobile.
 * The credit line is required verbatim (rules Â§2.4), so it stays English in both languages.
 */
export function SiteFooter() {
  const { t } = useT();
  return (
    <footer className="relative z-30 mt-auto border-t border-border bg-surface-1">
      <Container className="grid gap-8 py-10 md:grid-cols-3">
        <div className="flex flex-col gap-3">
          <Logo height={48} alt={t("brand.mark")} />
          <p className="max-w-[40ch] text-body-sm text-text-secondary">{t("footer.mission")}</p>
        </div>

        <nav aria-label={t("footer.links")} className="flex flex-col gap-1">
          <h2 className="mb-1 text-body-sm font-medium text-text-primary">{t("footer.links")}</h2>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex h-11 items-center text-body-sm text-text-secondary hover:text-text-primary"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <p className="text-caption text-text-muted md:self-end">{en["footer.credit"]}</p>
      </Container>
    </footer>
  );
}
