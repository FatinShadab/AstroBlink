/** Supported UI languages (brain §6, design §4.1). */
export const LANGS = ["en", "bn"] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}
