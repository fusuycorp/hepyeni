"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CommentThread } from "@/components/comment-thread";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";
import type { ActionResult } from "@/types/actions";
import type { PublicComment } from "@/lib/comments";

interface MediaCommentsProps {
  titleId: string;
  groupId: string;
  titleName: string;
  initialCount: number;
  currentUserId?: string;
  currentUserRole?: string;
  isAdmin?: boolean;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserAvatarUrl?: string;
  canComment?: boolean;
  onAddComment?: (
    titleId: string,
    formData: FormData,
  ) => Promise<ActionResult<PublicComment> | PublicComment>;
  onDeleteComment?: (commentId: string) => Promise<ActionResult<void> | void>;
  onFetchComments?: (titleId: string) => Promise<PublicComment[]>;
  triggerClassName?: string;
}

export function MediaComments({
  titleId,
  groupId,
  titleName,
  initialCount,
  currentUserId = "",
  currentUserRole,
  isAdmin,
  currentUserName,
  currentUserEmail,
  currentUserAvatarUrl,
  canComment = true,
  onAddComment,
  onDeleteComment,
  onFetchComments,
  triggerClassName,
}: MediaCommentsProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground font-medium rounded-lg transition-colors",
              initialCount > 0 && "text-foreground font-semibold",
              triggerClassName,
            )}
            aria-label={`${initialCount} ${t.comments.count}`}
          >
            <MessageSquare className="size-3.5" />
            <span>{initialCount > 0 ? initialCount : t.comments.title}</span>
          </Button>
        }
      />

      <DialogContent className="sm:max-w-lg max-h-[88dvh] flex flex-col p-3.5 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
                {t.comments.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {titleName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain min-h-[140px] max-h-[58dvh] pr-1">
          {open && (
            <CommentThread
              titleId={titleId}
              groupId={groupId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              isAdmin={isAdmin}
              currentUserName={currentUserName}
              currentUserEmail={currentUserEmail}
              currentUserAvatarUrl={currentUserAvatarUrl}
              canComment={canComment}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
              onFetchComments={onFetchComments}
              autoFetch={true}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
