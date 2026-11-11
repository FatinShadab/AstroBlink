"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Settings, X } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { LanguageToggle } from "@/components/settings/LanguageToggle";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";
import { cn } from "@/lib/utils/cn";
import { Container } from "./Container";
import { Logo } from "./Logo";

const NAV: { href: string; key: DictKey }[] = [
  { href: "/explore", key: "nav.explore" },
  { href: "/projects", key: "nav.projects" },
  { href: "/guide", key: "nav.guide" },
  { href: "/about", key: "nav.about" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sticky site header (design §7.3). Desktop: inline nav. Below 768px: a menu button
 * that drops a full-width sheet from the header (never a side drawer, rules §1.2).
 */
export function SiteHeader() {
  const { t } = useT();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet on navigation (state adjusted during render, not in an effect).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-14 border-b border-border-glass bg-surface-1 md:h-16",
        scrolled && "bg-surface-glass backdrop-blur-[12px]",
      )}
    >
      <Container className="flex h-full items-center gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-[var(--radius-sm)] font-display text-h4 font-semibold text-text-primary"
        >
          <Logo />
          <span>{t("brand.name")}</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center px-3 text-body-sm font-medium transition-colors",
                  active ? "text-text-primary" : "text-text-secondary hover:text-text-primary",
                  active &&
                    "after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:bg-primary after:content-['']",
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <LanguageToggle />
          <Button
            variant="icon"
            aria-label={t("header.settings")}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings aria-hidden="true" className="size-5" />
          </Button>
          <Link href="/login" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            {t("header.signIn")}
          </Link>
        </div>

        <Button
          variant="icon"
          className="ml-auto md:hidden"
          aria-label={menuOpen ? t("header.menuClose") : t("header.menuOpen")}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </Button>
      </Container>

      {menuOpen && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full border-b border-border bg-surface-1 md:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className="flex h-14 items-center px-4 text-body font-medium text-text-primary hover:bg-surface-2"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-4">
            <LanguageToggle />
            <Button
              variant="icon"
              aria-label={t("header.settings")}
              onClick={() => {
                setMenuOpen(false);
                setSettingsOpen(true);
              }}
            >
              <Settings aria-hidden="true" className="size-5" />
            </Button>
          </div>
        </div>
      )}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
