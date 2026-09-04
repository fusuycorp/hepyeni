"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AddTitleForm } from "@/app/groups/[groupId]/add/add-title-form";
import { useTranslations } from "@/lib/i18n/client";

interface AddTitleDialogProps {
  groupId: string;
  groupName?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddTitleDialog({
  groupId,
  groupName,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddTitleDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const t = useTranslations();
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  function handleSuccess() {
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger ? (trigger as React.ReactElement) : undefined} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm" className="gap-1.5 font-medium shadow-xs">
              <Plus className="size-4" />
              <span>{t.groups.proposeMedia}</span>
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-2xl max-h-[90dvh] flex flex-col p-3.5 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
            {t.groups.proposeMedia}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t.titles.addToGroupDesc.replace("{group}", groupName || t.titles.yourCircleGeneric)}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2 flex-1 overflow-y-auto overscroll-contain">
          <AddTitleForm
            groupId={groupId}
            isModal={true}
            onSuccess={handleSuccess}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
