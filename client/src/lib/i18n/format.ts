import type { Lang } from "./lang";

const LOCALE: Record<Lang, string> = { en: "en-GB", bn: "bn-BD" };

/** Dates as "14 May 2025" (design §14). Latin digits in English; Bangla digits in বাংলা. */
export function formatDate(iso: string, lang: Lang): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Timeline label such as "May ’25" (design §10). */
export function formatMonthYear(iso: string, lang: Lang): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const month = new Intl.DateTimeFormat(LOCALE[lang], { month: "short", timeZone: "UTC" }).format(
    date,
  );
  const year = new Intl.DateTimeFormat(LOCALE[lang], { year: "2-digit", timeZone: "UTC" }).format(
    date,
  );
  return `${month} ’${year}`;
}

/** Replace {name} placeholders. Missing values stay as written. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
