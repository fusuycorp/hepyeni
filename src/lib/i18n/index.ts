import { tr } from "./tr";
import { en } from "./en";
import type { Locale, Translations } from "./types";

export * from "./types";
export { tr, en };

const dictionaries: Record<Locale, Translations> = {
  tr,
  en,
};

export const defaultLocale: Locale = "tr";

export function getTranslations(locale: Locale = defaultLocale): Translations {
  return dictionaries[locale] || tr;
}

export const t = getTranslations("tr");

const RELATIVE_TIME_STEPS: ReadonlyArray<{
  limit: number;
  divisor: number;
  tr: string;
  en: string;
}> = [
  { limit: 3600, divisor: 60, tr: " dk önce", en: "m ago" },
  { limit: 86400, divisor: 3600, tr: " sa önce", en: "h ago" },
  { limit: 2592000, divisor: 86400, tr: " gün önce", en: "d ago" },
  { limit: 31104000, divisor: 2592000, tr: " ay önce", en: "mo ago" },
];

export function formatRelativeTime(
  dateInput: string | Date,
  locale: Locale = defaultLocale
): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  const isTr = locale === "tr";

  if (diffInSeconds < 60) return isTr ? "az önce" : "just now";

  for (const step of RELATIVE_TIME_STEPS) {
    if (diffInSeconds < step.limit) {
      const value = Math.floor(diffInSeconds / step.divisor);
      return `${value}${isTr ? step.tr : step.en}`;
    }
  }

  const years = Math.floor(diffInSeconds / 31104000);
  return `${years}${isTr ? " yıl önce" : "y ago"}`;
}
