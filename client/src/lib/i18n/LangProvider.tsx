"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { bn } from "./bn";
import { en, type DictKey } from "./en";
import { LANG_COOKIE, type Lang } from "./lang";
import { useUserStore } from "@/lib/state/useUserStore";
import { useHasHydrated } from "@/lib/state/useHasHydrated";

type Vars = Record<string, string | number>;

interface LangContextValue {
  lang: Lang;
  t: (key: DictKey, vars?: Vars) => string;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/**
 * Provides t(), lang and setLang(). The server passes the cookie value as
 * initialLang so <html lang> is correct on first paint; once the persisted
 * store has hydrated, its value wins.
 */
export function LangProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const hydrated = useHasHydrated();
  const storeLang = useUserStore((s) => s.settings.lang);
  const setStoreLang = useUserStore((s) => s.setLang);

  const lang: Lang = hydrated ? storeLang : initialLang;

  useEffect(() => {
    // Wait for the persisted value; before that, `lang` is only the placeholder default.
    if (!hydrated) return;
    document.documentElement.lang = lang;
    try {
      document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* cookies blocked: the page still works in the default language */
    }
  }, [lang, hydrated]);

  const setLang = useCallback((next: Lang) => setStoreLang(next), [setStoreLang]);

  const t = useCallback(
    (key: DictKey, vars?: Vars) => interpolate((lang === "bn" ? bn : en)[key], vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, t, setLang }), [lang, t, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be used inside <LangProvider>");
  return { t: ctx.t, lang: ctx.lang };
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return { lang: ctx.lang, setLang: ctx.setLang };
}
