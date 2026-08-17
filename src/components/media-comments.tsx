"use client";

import { useState, useTransition, useRef } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { canDeleteComment } from "@/lib/comments";
import { addComment, deleteComment } from "@/lib/actions/comments";
import { formatRelativeTime } from "@/lib/i18n";
import { getDisplayName, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  CommentsResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

interface MediaCommentsProps {
  titleId: string;
  groupId: string;
  titleName: string;
  comments: CommentsResponse<{ user?: UsersResponse }>[];
  currentUserId: string;
  currentUserRole?: string;
  isAdmin?: boolean;
  onAddComment?: (titleId: string, formData: FormData) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  triggerClassName?: string;
}

export function MediaComments({
  titleId,
  groupId,
  titleName,
  comments = [],
  currentUserId,
  currentUserRole,
  isAdmin,
  onAddComment,
  onDeleteComment,
  triggerClassName,
}: MediaCommentsProps) {
  const [open, setOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const count = comments.length;

  async function handleAddComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;

    const formData = new FormData();
    formData.append("content", text);

    startTransition(async () => {
      try {
        if (onAddComment) {
          await onAddComment(titleId, formData);
        } else {
          await addComment(titleId, groupId, formData);
        }
        setCommentText("");
        toast.success("Yorumunuz eklendi");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Yorum eklenirken bir hata oluştu",
        );
      }
    });
  }

  function handleDeleteComment(commentId: string) {
    setDeletingId(commentId);
    startTransition(async () => {
      try {
        if (onDeleteComment) {
          await onDeleteComment(commentId);
        } else {
          await deleteComment(commentId, groupId);
        }
        toast.success("Yorum silindi");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Yorum silinirken bir hata oluştu",
        );
      } finally {
        setDeletingId(null);
      }
    });
  }

  // Sort comments chronologically (oldest to newest)
  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

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
              count > 0 && "text-foreground font-semibold",
              triggerClassName,
            )}
            aria-label={`${count} yorum`}
          >
            <MessageSquare className="size-3.5" />
            <span>{count > 0 ? count : "Yorum"}</span>
          </Button>
        }
      />

      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
                Yorumlar
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {titleName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-[140px] max-h-[40vh]">
          {sortedComments.length > 0 ? (
            sortedComments.map((c) => {
              const author = c.expand?.user;
              const authorName = getDisplayName(author);
              const initials = getInitials(author?.name, author?.email);
              const canDelete = canDeleteComment({
                commentUserId: c.user,
                currentUserId,
                userRole: currentUserRole,
                isAdmin,
              });

              return (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1.5 text-xs transition-colors hover:bg-muted/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar size="sm" className="size-6 ring-1 ring-border shrink-0">
                        {author?.avatarUrl && (
                          <AvatarImage src={author.avatarUrl} alt={authorName} />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-foreground truncate">
                        {authorName}
                      </span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        &middot; {formatRelativeTime(c.createdAt)}
                      </span>
                    </div>

                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              aria-label="Yorumu Sil"
                              disabled={deletingId === c.id}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          }
                        />
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Yorumu Sil</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bu yorumu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => handleDeleteComment(c.id)}
                            >
                              Sil
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  <p className="text-foreground/90 whitespace-pre-wrap break-words leading-relaxed pl-8">
                    {c.content}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
              <MessageSquare className="size-8 text-muted-foreground/40" />
              <p className="text-xs">Henüz yorum yapılmamış.</p>
              <p className="text-[11px] text-muted-foreground/70">İlk yorumu siz paylaşın!</p>
            </div>
          )}
        </div>

        {/* Comment Input Form */}
        <form
          ref={formRef}
          onSubmit={handleAddComment}
          className="pt-3 border-t space-y-2"
        >
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Düşüncelerinizi paylaşın... (en fazla 2000 karakter)"
            rows={3}
            maxLength={2000}
            disabled={isPending}
            className="text-xs resize-none min-h-[70px] bg-background"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {commentText.length}/2000
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !commentText.trim()}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Send className="size-3.5" />
              <span>{isPending ? "Paylaşılıyor…" : "Paylaş"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
