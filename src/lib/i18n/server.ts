import { cookies } from "next/headers";
import { getTranslations, defaultLocale, Locale } from "./index";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE") || cookieStore.get("locale");
  const locale = localeCookie?.value as Locale | undefined;
  
  if (locale === "en" || locale === "tr") {
    return locale;
  }
  
  return defaultLocale;
}

export async function getServerTranslations() {
  const locale = await getLocale();
  return getTranslations(locale);
}
