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

export function formatRelativeTime(
  dateInput: string | Date,
  locale: Locale = defaultLocale
): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (locale === "tr") {
    if (diffInSeconds < 60) return "az önce";
    const minutes = Math.floor(diffInSeconds / 60);
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} sa önce`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} gün önce`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} ay önce`;
    const years = Math.floor(months / 12);
    return `${years} yıl önce`;
  }

  // English fallback
  if (diffInSeconds < 60) return "just now";
  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
