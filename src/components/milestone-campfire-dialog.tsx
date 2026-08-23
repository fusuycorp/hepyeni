"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Flame,
  Loader2,
  Lock,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  AlertTriangle,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SpoilerText } from "@/components/spoiler-text";
import {
  addMilestoneComment,
  deleteMilestoneComment,
  getMilestoneComments,
  type MilestoneCommentItem,
  type MilestoneWithCheckins,
} from "@/lib/actions/schedules";
import { getDisplayName, getInitials } from "@/lib/format";
import { formatRelativeTime } from "@/lib/i18n";
import { useTranslations, useLocale } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface MilestoneCampfireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: MilestoneWithCheckins | null;
  scheduleName?: string;
  groupId: string;
  currentUserId?: string;
  currentUserRole?: string;
  isAdmin?: boolean;
  isMember?: boolean;
  onCheckinToggle?: (milestoneId: string) => void;
}

export function MilestoneCampfireDialog({
  open,
  onOpenChange,
  milestone,
  scheduleName,
  groupId,
  currentUserId,
  currentUserRole,
  isAdmin,
  isMember = true,
  onCheckinToggle,
}: MilestoneCampfireDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [comments, setComments] = useState<MilestoneCommentItem[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedCount, setLockedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = async (milestoneId: string) => {
    setLoading(true);
    try {
      const res = await getMilestoneComments(milestoneId, groupId);
      if (res.success) {
        setComments(res.data.comments);
        setIsLocked(res.data.isLocked);
        setLockedCount(res.data.lockedCount);
      } else {
        toast.error(res.error || t.campfires.messageAddFailed);
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && milestone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-open resets + loads state as a deliberate effect of the open/milestone prop
      fetchComments(milestone.id);
    } else {
      setComments([]);
      setCommentText("");
      setIsSpoiler(false);
    }
  }, [open, milestone?.id, groupId, milestone?.hasCheckedIn]);

  if (!milestone) return null;

  const handleAddComment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;

    const formData = new FormData();
    formData.append("content", text);
    if (isSpoiler) {
      formData.append("isSpoiler", "true");
    }

    startTransition(async () => {
      const res = await addMilestoneComment(milestone.id, groupId, formData);
      if (!res.success) {
        toast.error(res.error || t.campfires.messageAddFailed, {
          description: res.traceId ? `Ref: ${res.traceId}` : undefined,
        });
        return;
      }

      toast.success(t.campfires.messageAdded);
      setComments((prev) => [...prev, res.data]);
      setCommentText("");
      setIsSpoiler(false);
    });
  };

  const handleDeleteComment = (commentId: string) => {
    setDeletingId(commentId);
    startTransition(async () => {
      const res = await deleteMilestoneComment(commentId, groupId);
      setDeletingId(null);
      if (!res.success) {
        toast.error(res.error || t.campfires.messageDeleteFailed, {
          description: res.traceId ? `Ref: ${res.traceId}` : undefined,
        });
        return;
      }

      toast.success(t.campfires.messageDeleted);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const handleUnlockClick = () => {
    if (onCheckinToggle) {
      onCheckinToggle(milestone.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Flame className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight truncate">
                  {milestone.title}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0"
                >
                  {t.campfires.campfireTitle}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {scheduleName ? `${scheduleName} &middot; ` : ""}
                {t.campfires.campfireSubtitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Campfire Discussion Content */}
        <div className="flex-1 overflow-y-auto min-h-[160px] max-h-[50vh] pr-1 space-y-3 py-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground space-y-2">
              <Loader2 className="size-5 animate-spin text-amber-500" />
              <p className="text-xs">{t.common.loading}</p>
            </div>
          ) : isLocked ? (
            <div className="space-y-4">
              {/* Locked Banner */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mx-auto">
                  <Lock className="size-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t.campfires.lockedTitle}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    {t.campfires.lockedDesc}
                  </p>
                </div>

                {isMember && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleUnlockClick}
                    className="gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>{t.campfires.checkInToUnlock}</span>
                  </Button>
                )}
              </div>

              {/* Redacted Placeholder Cards */}
              {comments.length > 0 ? (
                <div className="space-y-2 opacity-60">
                  {comments.map((c) => {
                    const authorName = getDisplayName(c.author, t.common.unnamedUser);
                    const initials = getInitials(c.author?.name);

                    return (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-center gap-3 text-xs"
                      >
                        <Avatar size="sm" className="size-6 ring-1 ring-border shrink-0">
                          {c.author?.avatarUrl && (
                            <AvatarImage src={c.author.avatarUrl} alt={authorName} />
                          )}
                          <AvatarFallback className="text-[9px]">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <span className="text-muted-foreground italic truncate">
                            {t.campfires.lockedCommentPlaceholder.replace("{name}", authorName)}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(c.createdAt, locale)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : comments.length > 0 ? (
            comments.map((c) => {
              const authorName = getDisplayName(c.author, t.common.unnamedUser);
              const initials = getInitials(c.author?.name);
              const isOwn = c.user === currentUserId;
              const canDelete =
                isOwn || currentUserRole === "owner" || Boolean(isAdmin);

              return (
                <div
                  key={c.id}
                  className={cn(
                    "p-3 rounded-xl border space-y-2 text-xs transition-colors",
                    isOwn
                      ? "bg-amber-500/5 border-amber-500/20"
                      : "bg-muted/30 border-border/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar size="sm" className="size-6 ring-1 ring-border shrink-0">
                        {c.author?.avatarUrl && (
                          <AvatarImage src={c.author.avatarUrl} alt={authorName} />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-foreground truncate">
                        {authorName}
                      </span>
                      {c.isSpoiler && (
                        <Badge
                          variant="destructive"
                          className="text-[9px] py-0 px-1 font-normal uppercase gap-0.5"
                        >
                          <EyeOff className="size-2.5" />
                          <span>{t.spoilers.spoilerBadge}</span>
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        &middot; {formatRelativeTime(c.createdAt, locale)}
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
                              disabled={deletingId === c.id}
                              aria-label={t.common.delete}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          }
                        />
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t.common.confirm}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t.campfires.deleteMessageConfirm}
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

                  <div className="text-foreground/90 whitespace-pre-wrap break-words leading-relaxed pl-8">
                    <SpoilerText text={c.content} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground space-y-2">
              <Flame className="size-8 text-amber-500/40" />
              <p className="text-xs">{t.campfires.noComments}</p>
            </div>
          )}
        </div>

        {/* Campfire Input Form (Only if unlocked and member) */}
        {!isLocked && isMember && (
          <form
            ref={formRef}
            onSubmit={handleAddComment}
            className="pt-3 border-t space-y-2"
          >
            <Textarea
              ref={textareaRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.campfires.addMessage}
              rows={2}
              maxLength={2000}
              disabled={isPending}
              className="text-xs resize-none min-h-[60px] bg-background"
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSpoiler}
                    onChange={(e) => setIsSpoiler(e.target.checked)}
                    className="size-3.5 rounded border-input text-amber-500 focus:ring-amber-500"
                  />
                  <span>{t.spoilers.markAsSpoiler}</span>
                </label>

                <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
                  {t.spoilers.spoilerSyntaxHint}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {commentText.length}/2000
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !commentText.trim()}
                  className="gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs"
                >
                  <Send className="size-3.5" />
                  <span>
                    {isPending ? t.campfires.posting : t.campfires.postMessage}
                  </span>
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
