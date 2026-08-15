"use client";

import { useTransition } from "react";
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
  confirmLabel = "Confirm",
  pendingLabel = "Working…",
  variant = "destructive",
  triggerVariant = variant,
  size = "sm",
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
  onConfirm: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
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
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await onConfirm();
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Something went wrong — try again.",
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
