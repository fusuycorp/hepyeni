"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/actions/auth";

export function SendResetLinkButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

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
      {sent ? "Sıfırlama bağlantısı gönderildi" : isPending ? "Gönderiliyor…" : "Şifre sıfırlama bağlantısı gönder"}
    </Button>
  );
}
