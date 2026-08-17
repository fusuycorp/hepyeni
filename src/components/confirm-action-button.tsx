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

export function ConfirmActionButton({
  triggerLabel,
  title,
  description,
  confirmLabel = "Onayla",
  pendingLabel = "İşleniyor…",
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
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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
          <AlertDialogCancel>İptal</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await onConfirm();
                  if (redirectTo) {
                    router.push(redirectTo);
                  } else {
                    setOpen(false);
                  }
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Bir sorun oluştu — lütfen tekrar deneyin.",
                  );
                }
              })
            }
          >
            {isPending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
