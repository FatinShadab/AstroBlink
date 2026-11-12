"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { en } from "@/lib/i18n/en";
import { useT } from "@/lib/i18n/LangProvider";
import { Container } from "./Container";
import { Logo } from "./Logo";

const PAGES = [
  { href: "/", key: "nav.home" },
  { href: "/projects", key: "nav.projects" },
  { href: "/explore", key: "nav.explore" },
  { href: "/guide", key: "nav.guide" },
  { href: "/about", key: "nav.about" },
  { href: "/embed?preset=barnard", key: "footer.embed" },
] as const;

/** Copyright year. Fixed, because a live date cannot be prerendered in a client component. */
const COPYRIGHT_YEAR = 2026;

/**
 * Footer. Layout: a brand block with a call to action on the right, page links in two columns,
 * a divider, a copyright row and a faint wordmark. Only real AstroBlink pages and text appear here.
 * The credit line is required verbatim (rules §2.4), so it stays English in both languages.
 */
export function SiteFooter() {
  const { t } = useT();
  return (
    <footer className="relative z-30 mt-auto overflow-hidden border-t border-border bg-surface-1">
      <Container className="grid gap-10 pt-12 md:grid-cols-12 md:pt-16">
        <div className="flex flex-col gap-6 md:col-span-5">
          <Logo height={44} alt={t("brand.mark")} />
          <p className="max-w-[40ch] text-body-sm text-text-secondary">{t("footer.mission")}</p>
        </div>

        <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface-2 p-6 md:col-span-7">
          <h2 className="font-display text-h4 font-semibold text-text-primary">{t("footer.ctaTitle")}</h2>
          <p className="text-body-sm text-text-secondary">{t("footer.ctaBody")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/projects" className={buttonStyles({ variant: "primary" })}>
              {t("footer.ctaProjects")}
            </Link>
            <Link href="/explore" className={buttonStyles({ variant: "secondary" })}>
              {t("footer.ctaExplore")}
            </Link>
          </div>
        </div>

        <nav aria-label={t("footer.links")} className="flex flex-col gap-3 md:col-span-12">
          <h2 className="text-body-sm font-semibold text-text-primary">{t("footer.pages")}</h2>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3">
            {PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="flex h-11 items-center gap-2 text-body-sm text-text-secondary hover:text-text-primary"
                >
                  <ChevronRight aria-hidden="true" className="size-4 text-border-strong" />
                  {t(page.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>

      <Container className="mt-10">
        <div className="flex flex-col gap-3 border-t border-border py-6 md:flex-row md:items-center md:justify-between">
          <p className="text-caption text-text-muted">
            © {COPYRIGHT_YEAR} {t("brand.name")}
          </p>
          <p className="max-w-[72ch] text-caption text-text-muted">{en["footer.credit"]}</p>
        </div>
      </Container>

      <p
        aria-hidden="true"
        className="pointer-events-none mt-4 -mb-[0.2em] select-none text-center font-display text-[clamp(3rem,12.5vw,10rem)] leading-none font-semibold tracking-tight text-border/40"
      >
        ASTROBLINK
      </p>
    </footer>
  );
}
