"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
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
import { addComment, deleteComment, getComments } from "@/lib/actions/comments";
import { formatRelativeTime } from "@/lib/i18n";
import { getDisplayName, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "@/lib/i18n/client";
import type {
  CommentsResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

type OptimisticComment = {
  id: string;
  content: string;
  createdAt: string;
  pending: true;
  author: { name?: string; email?: string; avatarUrl?: string };
};

type DisplayComment = CommentsResponse<{ user?: UsersResponse }> | OptimisticComment;

interface MediaCommentsProps {
  titleId: string;
  groupId: string;
  titleName: string;
  initialCount: number;
  currentUserId: string;
  currentUserRole?: string;
  isAdmin?: boolean;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserAvatarUrl?: string;
  onAddComment?: (
    titleId: string,
    formData: FormData,
  ) => Promise<CommentsResponse<{ user?: UsersResponse }>>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onFetchComments?: (
    titleId: string,
  ) => Promise<CommentsResponse<{ user?: UsersResponse }>[]>;
  triggerClassName?: string;
}

export function MediaComments({
  titleId,
  groupId,
  titleName,
  initialCount,
  currentUserId,
  currentUserRole,
  isAdmin,
  currentUserName,
  currentUserEmail,
  currentUserAvatarUrl,
  onAddComment,
  onDeleteComment,
  onFetchComments,
  triggerClassName,
}: MediaCommentsProps) {
  const [open, setOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [comments, setComments] = useState<DisplayComment[]>([]);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();
  const locale = useLocale();

  const count = hasFetchedOnce ? comments.length : initialCount;

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments.length]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;

    setLoading(true);
    (async () => {
      try {
        const fetched = onFetchComments
          ? await onFetchComments(titleId)
          : await getComments(titleId, groupId);
        setComments(fetched);
        setHasFetchedOnce(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.common.error);
      } finally {
        setLoading(false);
      }
    })();
  }

  async function handleAddComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: OptimisticComment = {
      id: tempId,
      content: text,
      createdAt: new Date().toISOString(),
      pending: true,
      author: {
        name: currentUserName,
        email: currentUserEmail,
        avatarUrl: currentUserAvatarUrl,
      },
    };

    setComments((prev) => [...prev, optimistic]);
    setCommentText("");

    const formData = new FormData();
    formData.append("content", text);

    startTransition(async () => {
      try {
        const created = onAddComment
          ? await onAddComment(titleId, formData)
          : await addComment(titleId, groupId, formData);
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? created : c)),
        );
        toast.success(t.comments.added);
      } catch (err) {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setCommentText(text);
        toast.error(
          err instanceof Error ? err.message : t.comments.addFailed,
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
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        toast.success(t.comments.deleted);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t.comments.deleteFailed,
        );
      } finally {
        setDeletingId(null);
      }
    });
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  // Sort comments chronologically (oldest to newest)
  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            aria-label={`${count} ${t.comments.count}`}
          >
            <MessageSquare className="size-3.5" />
            <span>{count > 0 ? count : t.comments.title}</span>
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
                {t.comments.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {titleName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Comments List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-[140px] max-h-[40vh]"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
              <Loader2 className="size-5 animate-spin" />
              <p className="text-xs">{t.common.loading}</p>
            </div>
          ) : sortedComments.length > 0 ? (
            sortedComments.map((c) => {
              const isPendingComment = "pending" in c;
              const author = isPendingComment ? c.author : c.expand?.user;
              const authorName = getDisplayName(author);
              const initials = getInitials(author?.name, author?.email);
              const isOwn = isPendingComment || c.user === currentUserId;
              const canDelete = !isPendingComment && canDeleteComment({
                commentUserId: c.user,
                currentUserId,
                userRole: currentUserRole,
                isAdmin,
              });

              return (
                <div
                  key={c.id}
                  className={cn(
                    "p-3 rounded-xl border space-y-1.5 text-xs transition-colors",
                    isOwn
                      ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                      : "bg-muted/40 border-border/50 hover:bg-muted/60",
                    isPendingComment && "opacity-60",
                  )}
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
                      {!isPendingComment && (
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          &middot; {formatRelativeTime(c.createdAt, locale)}
                        </span>
                      )}
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
                              aria-label={t.comments.delete}
                              disabled={deletingId === c.id}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          }
                        />
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t.comments.delete}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t.comments.deleteConfirm}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => handleDeleteComment(c.id)}
                            >
                              {t.common.delete}
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
              <p className="text-xs">{t.comments.noComments}</p>
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
            onKeyDown={handleTextareaKeyDown}
            placeholder={t.comments.placeholder}
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
              <span>{isPending ? t.comments.posting : t.comments.post}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
