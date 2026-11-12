"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useT } from "@/lib/i18n/LangProvider";
import { useUserStore } from "@/lib/state/useUserStore";
import { useHasHydrated } from "@/lib/state/useHasHydrated";
import type { DictKey } from "@/lib/i18n/en";
import { cn } from "@/lib/utils/cn";
import { AccountMenu } from "./AccountMenu";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { useSignOut } from "./useSignOut";

const NAV: { href: string; key: DictKey }[] = [
  { href: "/", key: "nav.home" },
  { href: "/projects", key: "nav.projects" },
  { href: "/explore", key: "nav.explore" },
  { href: "/guide", key: "nav.guide" },
  { href: "/about", key: "nav.about" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sticky site header (design §7.3). Logo left, page links centre, profile right.
 * Settings and sign out live in the profile menu. Below 768px: a menu button drops a sheet
 * from the header (never a side drawer, rules §1.2).
 */
export function SiteHeader() {
  const { t } = useT();
  const pathname = usePathname();
  const signOut = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Persisted state is shown only after hydration, so server and client markup match (architecture §7.3).
  const storeUser = useUserStore((s) => s.user);
  const hydrated = useHasHydrated();
  const user = hydrated ? storeUser : null;

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
      {/* Three columns: logo left, page links centred, profile right (mobile: menu right). */}
      <Container
        variant="wide"
        className="grid h-full grid-cols-[auto_1fr_auto] items-center gap-4 px-3 sm:px-5 md:grid-cols-[1fr_auto_1fr] lg:px-5"
      >
        <Link
          href="/"
          className="flex items-center gap-2 justify-self-start rounded-[var(--radius-sm)] font-display text-h4 font-semibold text-text-primary"
        >
          <Logo height={44} alt={t("brand.mark")} />
        </Link>

        <nav
          aria-label={t("header.mainNav")}
          className="hidden items-center gap-1 justify-self-center md:flex"
        >
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

        <div className="hidden justify-self-end md:flex">
          {user ? (
            <AccountMenu user={user} onSettings={() => setSettingsOpen(true)} />
          ) : (
            <Link href="/login" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              {t("header.signIn")}
            </Link>
          )}
        </div>

        <Button
          variant="icon"
          className="justify-self-end md:hidden"
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
          <nav aria-label={t("header.mobileNav")} className="flex flex-col">
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
          <div className="flex flex-col border-t border-border">
            {user ? (
              <>
                <Link
                  href="/me"
                  className="flex h-14 items-center px-4 text-body text-text-primary hover:bg-surface-2"
                >
                  {t("header.myStats")}
                </Link>
                <Link
                  href="/me/certificate"
                  className="flex h-14 items-center px-4 text-body text-text-primary hover:bg-surface-2"
                >
                  {t("header.certificate")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="flex h-14 items-center px-4 text-left text-body text-text-primary hover:bg-surface-2"
                >
                  {t("header.settings")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="flex h-14 items-center px-4 text-left text-body text-danger hover:bg-danger-subtle"
                >
                  {t("header.signOut")}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="flex h-14 items-center px-4 text-body text-primary hover:bg-surface-2"
              >
                {t("header.signIn")}
              </Link>
            )}
          </div>
        </div>
      )}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
