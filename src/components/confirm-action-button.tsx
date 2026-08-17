"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/client";
import type { ActionResult } from "@/types/actions";

export function ConfirmActionButton({
  triggerLabel,
  title,
  description,
  confirmLabel,
  pendingLabel,
  variant = "destructive",
  triggerVariant = variant,
  size = "sm",
  redirectTo,
  onConfirm,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
  pendingLabel?: string;
  variant?: "destructive" | "default";
  triggerVariant?: "destructive" | "default" | "outline" | "ghost";
  size?: "sm" | "default" | "xs";
  // Where to navigate after onConfirm succeeds. The server actions this
  // wraps don't redirect() themselves when they're meant to be called this
  // way — see the comment in src/lib/actions/groups.ts — so navigation is
  // this component's job.
  redirectTo?: string;
  onConfirm: () => Promise<ActionResult<void> | void>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations();
  const resolvedConfirmLabel = confirmLabel ?? t.common.confirm;
  const resolvedPendingLabel = pendingLabel ?? t.common.working;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant={triggerVariant} size={size}>
            {triggerLabel}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const res = await onConfirm();
                  if (res && typeof res === "object" && "success" in res && !res.success) {
                    toast.error(res.error, {
                      description: res.traceId ? `Ref: ${res.traceId}` : undefined,
                    });
                    return;
                  }
                  if (redirectTo) {
                    router.push(redirectTo);
                  } else {
                    setOpen(false);
                  }
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : t.auth.errors.default,
                  );
                }
              })
            }
          >
            {isPending ? resolvedPendingLabel : resolvedConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
