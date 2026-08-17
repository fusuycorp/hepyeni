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
              <span>Medya Öner</span>
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
            Medya Öner
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {groupName ? `${groupName} listesine ` : "Grubunuza "}
            eklemek için kitap, film, dizi, müzik veya podcast arayın.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2 flex-1 overflow-y-auto">
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
