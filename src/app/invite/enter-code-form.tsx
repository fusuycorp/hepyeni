"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/client";

export function EnterCodeForm() {
  const t = useTranslations();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean || clean.length < 4) {
      setError(t.invite.invalidCodeFormat);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    router.push(`/invite/${encodeURIComponent(clean)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="relative">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            placeholder={t.invite.codePlaceholder}
            maxLength={16}
            autoFocus
            className="text-center font-mono uppercase text-base tracking-widest h-12 bg-background border-border"
          />
        </div>
        {error && (
          <p className="text-xs text-destructive font-medium text-center">
            {error}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || !code.trim()}
        className="w-full h-11 font-semibold gap-2 shadow-xs"
      >
        <span>{t.invite.continueButton}</span>
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
