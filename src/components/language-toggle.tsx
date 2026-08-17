"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export function LanguageToggle({ className }: { className?: string }) {
  const router = useRouter();
  const { locale, setLocale } = useI18n();

  function toggleLanguage() {
    const nextLocale = locale === "tr" ? "en" : "tr";
    setLocale(nextLocale);
    document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = nextLocale;
    window.dispatchEvent(new Event("languagechange"));
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={toggleLanguage}
      aria-label={locale === "tr" ? "Switch to English" : "Türkçe'ye geç"}
      title={locale === "tr" ? "Switch to English" : "Türkçe'ye geç"}
    >
      <Languages className="size-3.5 text-muted-foreground mr-1" />
      <span className="text-xs font-semibold tracking-wider uppercase">
        {locale === "tr" ? "TR" : "EN"}
      </span>
    </Button>
  );
}

