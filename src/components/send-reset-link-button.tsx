"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/actions/auth";
import { useTranslations } from "@/lib/i18n/client";

export function SendResetLinkButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending || sent}
      onClick={() =>
        startTransition(async () => {
          const formData = new FormData();
          formData.set("email", email);
          await requestPasswordReset(formData);
          setSent(true);
        })
      }
    >
      {sent ? t.auth.resetLinkSentTag : isPending ? t.auth.sendingLink : t.profile.sendResetEmail}
    </Button>
  );
}
