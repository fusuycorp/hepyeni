"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CornerDownRight, Loader2, MessageSquare, Reply, Send, Trash2, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { canDeleteComment, organizeCommentsTree } from "@/lib/comments";
import { addComment, deleteComment, getComments } from "@/lib/actions/comments";
import { formatRelativeTime } from "@/lib/i18n";
import { getDisplayName, getInitials } from "@/lib/format";
import { useTranslations, useLocale } from "@/lib/i18n/client";
import { SpoilerText } from "@/components/spoiler-text";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types/actions";
import type { PublicComment } from "@/lib/comments";

export type OptimisticComment = {
  id: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
  pending: true;
  author: { name?: string; avatarUrl?: string };
};

export type DisplayComment = PublicComment | OptimisticComment;

export interface CommentThreadProps {
  titleId: string;
  groupId: string;
  initialComments?: DisplayComment[];
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
  className?: string;
  autoFetch?: boolean;
}

export function CommentThread({
  titleId,
  groupId,
  initialComments = [],
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
  className,
  autoFetch = false,
}: CommentThreadProps) {
  const [comments, setComments] = useState<DisplayComment[]>(initialComments);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    authorName: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();
  const locale = useLocale();

  useEffect(() => {
    if (initialComments.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync parent-supplied comments when the prop changes; no remount key is available at the call sites
      setComments(initialComments);
    }
  }, [initialComments]);

  useEffect(() => {
    if (autoFetch && initialComments.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate loading state for a one-shot async fetch on mount
      setLoading(true);
      (async () => {
        try {
          const fetched = onFetchComments
            ? await onFetchComments(titleId)
            : await getComments(titleId, groupId);
          setComments(fetched);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t.common.error);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [autoFetch, titleId, groupId, onFetchComments, initialComments.length, t.common.error]);

  async function handleAddComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const parentId = replyingTo?.id || null;

    const optimistic: OptimisticComment = {
      id: tempId,
      content: text,
      createdAt: new Date().toISOString(),
      parentId,
      pending: true,
      author: {
        name: currentUserName,
        avatarUrl: currentUserAvatarUrl,
      },
    };

    setComments((prev) => [...prev, optimistic]);
    setCommentText("");
    setReplyingTo(null);

    const formData = new FormData();
    formData.append("content", text);
    if (parentId) {
      formData.append("parentId", parentId);
    }

    startTransition(async () => {
      try {
        const res = onAddComment
          ? await onAddComment(titleId, formData)
          : await addComment(titleId, groupId, formData);
        if (res && typeof res === "object" && "success" in res) {
          if (!res.success) {
            setComments((prev) => prev.filter((c) => c.id !== tempId));
            setCommentText(text);
            toast.error(res.error || t.comments.addFailed, {
              description: res.traceId ? t.common.refCode.replace("{code}", res.traceId) : undefined,
            });
            return;
          }
          const created = res.data;
          setComments((prev) =>
            prev.map((c) => (c.id === tempId ? created : c)),
          );
          toast.success(t.comments.added);
          return;
        }
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? (res as PublicComment) : c)),
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
        const res = onDeleteComment
          ? await onDeleteComment(commentId)
          : await deleteComment(commentId, groupId);
        if (res && typeof res === "object" && "success" in res && !res.success) {
          toast.error(res.error || t.comments.deleteFailed, {
            description: res.traceId ? t.common.refCode.replace("{code}", res.traceId) : undefined,
          });
          return;
        }
        // Remove the deleted comment and any direct replies from view
        setComments((prev) =>
          prev.filter((c) => c.id !== commentId && c.parentId !== commentId),
        );
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

  function handleStartReply(commentId: string, authorName: string) {
    setReplyingTo({ id: commentId, authorName });
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  const commentTree = organizeCommentsTree(comments);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Comments List */}
      <div ref={listRef} className="space-y-3 pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
            <Loader2 className="size-5 animate-spin" />
            <p className="text-xs">{t.common.loading}</p>
          </div>
        ) : commentTree.length > 0 ? (
          commentTree.map((root) => {
            const isPendingComment = "pending" in root;
            const author = isPendingComment ? root.author : root.expand?.user;
            const authorName = getDisplayName(author, t.common.unnamedUser);
            const initials = getInitials(author?.name);
            const isOwn = isPendingComment || root.user === currentUserId;
            const canDelete =
              !isPendingComment &&
              canDeleteComment({
                commentUserId: root.user,
                currentUserId,
                userRole: currentUserRole,
                isAdmin,
              });

            return (
              <div key={root.id} className="space-y-2">
                {/* Root Comment Card */}
                <div
                  className={cn(
                    "p-3 sm:p-3.5 rounded-xl border space-y-2 text-xs transition-colors",
                    isOwn
                      ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                      : "bg-muted/40 border-border/60 hover:bg-muted/60",
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
                          &middot; {formatRelativeTime(root.createdAt, locale)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Reply Button (Only on top-level root comments for +1 depth) */}
                      {!isPendingComment && Boolean(currentUserId) && canComment && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => handleStartReply(root.id, authorName)}
                          className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground font-medium"
                        >
                          <Reply className="size-3" />
                          <span>{t.comments.reply}</span>
                        </Button>
                      )}

                      {/* Delete Button */}
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
                                disabled={deletingId === root.id}
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
                                onClick={() => handleDeleteComment(root.id)}
                              >
                                {t.common.delete}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>

                  <div className="text-foreground/90 whitespace-pre-wrap break-words leading-relaxed pl-8">
                    <SpoilerText text={root.content} />
                  </div>
                </div>

                {/* +1 Depth Nested Replies */}
                {root.replies && root.replies.length > 0 && (
                  <div className="pl-4 sm:pl-6 ml-3 sm:ml-4 border-l-2 border-primary/20 space-y-2">
                    {root.replies.map((reply) => {
                      const isReplyPending = "pending" in reply;
                      const replyAuthor = isReplyPending
                        ? reply.author
                        : reply.expand?.user;
                      const replyAuthorName = getDisplayName(replyAuthor, t.common.unnamedUser);
                      const replyInitials = getInitials(replyAuthor?.name);
                      const isReplyOwn =
                        isReplyPending || reply.user === currentUserId;
                      const canDeleteReply =
                        !isReplyPending &&
                        canDeleteComment({
                          commentUserId: reply.user,
                          currentUserId,
                          userRole: currentUserRole,
                          isAdmin,
                        });

                      return (
                        <div
                          key={reply.id}
                          className={cn(
                            "p-2.5 sm:p-3 rounded-lg border space-y-1.5 text-xs transition-colors",
                            isReplyOwn
                              ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                              : "bg-muted/30 border-border/50 hover:bg-muted/50",
                            isReplyPending && "opacity-60",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <CornerDownRight className="size-3 text-muted-foreground/60 shrink-0" />
                              <Avatar size="sm" className="size-5 ring-1 ring-border shrink-0">
                                {replyAuthor?.avatarUrl && (
                                  <AvatarImage
                                    src={replyAuthor.avatarUrl}
                                    alt={replyAuthorName}
                                  />
                                )}
                                <AvatarFallback className="text-[9px]">
                                  {replyInitials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-semibold text-foreground truncate text-[11px]">
                                {replyAuthorName}
                              </span>
                              {!isReplyPending && (
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  &middot;{" "}
                                  {formatRelativeTime(reply.createdAt, locale)}
                                </span>
                              )}
                            </div>

                            {canDeleteReply && (
                              <AlertDialog>
                                <AlertDialogTrigger
                                  render={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      className="size-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      aria-label={t.comments.delete}
                                      disabled={deletingId === reply.id}
                                    >
                                      <Trash2 className="size-3" />
                                    </Button>
                                  }
                                />
                                <AlertDialogContent size="sm">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {t.comments.delete}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t.comments.deleteConfirm}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      {t.common.cancel}
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      variant="destructive"
                                      onClick={() => handleDeleteComment(reply.id)}
                                    >
                                      {t.common.delete}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>

                          <div className="text-foreground/90 whitespace-pre-wrap break-words leading-relaxed pl-5 text-[11px]">
                            <SpoilerText text={reply.content} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

      {/* Reply Input Form */}
      {canComment && Boolean(currentUserId) && (
        <form
          ref={formRef}
          onSubmit={handleAddComment}
          className="pt-3 border-t space-y-2"
        >
          {replyingTo && (
            <div className="flex items-center justify-between px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs">
              <div className="flex items-center gap-1.5 text-primary font-medium">
                <Reply className="size-3" />
                <span>
                  {t.comments.replyingTo.replace("{name}", replyingTo.authorName)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                aria-label={t.comments.cancelReply}
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={
              replyingTo
                ? t.comments.replyPlaceholder
                : t.comments.placeholder
            }
            rows={3}
            maxLength={2000}
            disabled={isPending}
            className="text-xs resize-none min-h-[70px] bg-background"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {commentText.length}/2000
            </span>
            <div className="flex items-center gap-2">
              {replyingTo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setReplyingTo(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t.comments.cancelReply}
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={isPending || !commentText.trim()}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Send className="size-3.5" />
                <span>
                  {isPending
                    ? t.comments.posting
                    : replyingTo
                    ? t.comments.reply
                    : t.comments.post}
                </span>
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
