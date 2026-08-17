"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/client";

export function InlineTextForm({
  defaultValue,
  fieldName = "name",
  onSubmit,
  successMessage,
  errorMessage,
  submitLabel,
  pendingLabel,
}: {
  defaultValue: string;
  fieldName?: string;
  onSubmit: (formData: FormData) => Promise<void>;
  successMessage: string;
  errorMessage: string;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();
  const resolvedSubmitLabel = submitLabel ?? t.common.save;
  const resolvedPendingLabel = pendingLabel ?? t.common.saving;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await onSubmit(formData);
        toast.success(successMessage);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : errorMessage);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input name={fieldName} defaultValue={defaultValue} required maxLength={200} />
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? resolvedPendingLabel : resolvedSubmitLabel}
      </Button>
    </form>
  );
}
