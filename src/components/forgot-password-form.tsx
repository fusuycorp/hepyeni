"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/actions/auth";
import { useTranslations } from "@/lib/i18n/client";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        {t.auth.forgotPasswordSentNotice}
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await requestPasswordReset(formData);
      setSent(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Input type="email" name="email" required placeholder={t.auth.emailPlaceholder} />
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? t.auth.sendingLink : t.auth.sendResetLinkButton}
      </Button>
    </form>
  );
}
