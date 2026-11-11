/** Supported UI languages (brain §6, design §4.1). */
export const LANGS = ["en", "bn"] as const;
export type Lang = (typeof LANGS)[number];

/** Cookie read by the root layout so <html lang> is right on first paint (architecture §9). */
export const LANG_COOKIE = "astroblink-lang";

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}
