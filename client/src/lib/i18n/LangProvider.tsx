"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { en, type DictKey } from "./en";
import type { Lang } from "./lang";

/**
 * The app is English-only. The language switch was removed, so the language is fixed here.
 * The Bangla dictionary (bn.ts) is no longer loaded by the UI.
 */
const LANG: Lang = "en";

type Vars = Record<string, string | number>;

interface LangContextValue {
  lang: Lang;
  t: (key: DictKey, vars?: Vars) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/** Provides t() and the fixed language. */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const t = useCallback((key: DictKey, vars?: Vars) => interpolate(en[key], vars), []);
  const value = useMemo(() => ({ lang: LANG, t }), [t]);
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
  return { lang: ctx.lang };
}
