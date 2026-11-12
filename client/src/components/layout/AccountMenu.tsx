"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n/LangProvider";
import type { UserProfile } from "@/lib/state/useUserStore";
import { useSignOut } from "./useSignOut";
import { cn } from "@/lib/utils/cn";

const ITEM =
  "flex h-11 w-full items-center rounded-[var(--radius-sm)] px-3 text-left text-body-sm font-medium text-text-primary hover:bg-surface-2";

export function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/**
 * Profile button with a small menu: name, my stats, certificate, settings, and sign out.
 * Closes on outside click, on Escape, and after choosing an item.
 */
export function AccountMenu({ user, onSettings }: { user: UserProfile; onSettings: () => void }) {
  const { t } = useT();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("header.account")}
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-full bg-primary-subtle font-display text-body-sm font-semibold text-primary"
      >
        {initialsOf(user.name)}
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute top-full right-0 z-50 mt-2 w-60 rounded-[var(--radius-md)] border border-border bg-surface-1 p-2"
        >
          <div className="px-3 py-2">
            <p className="truncate font-medium text-text-primary">{user.name}</p>
            {user.email && <p className="truncate text-caption text-text-muted">{user.email}</p>}
          </div>
          <div className="my-1 h-px bg-border" />
          <Link href="/me" onClick={() => setOpen(false)} className={ITEM}>
            {t("header.myStats")}
          </Link>
          <Link href="/me/certificate" onClick={() => setOpen(false)} className={ITEM}>
            {t("header.certificate")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
            className={ITEM}
          >
            {t("header.settings")}
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className={cn(ITEM, "text-danger hover:bg-danger-subtle")}
          >
            {t("header.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
