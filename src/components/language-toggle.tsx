"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

function getLocaleSnapshot(): "tr" | "en" {
  if (typeof document === "undefined") return "tr";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  if (match && (match[1] === "en" || match[1] === "tr")) {
    return match[1];
  }
  return "tr";
}

function getServerSnapshot(): "tr" | "en" {
  return "tr";
}

function subscribe(callback: () => void) {
  window.addEventListener("languagechange", callback);
  return () => window.removeEventListener("languagechange", callback);
}

export function LanguageToggle({ className }: { className?: string }) {
  const router = useRouter();
  const locale = useSyncExternalStore(subscribe, getLocaleSnapshot, getServerSnapshot);

  function toggleLanguage() {
    const nextLocale = locale === "tr" ? "en" : "tr";
    document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
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

