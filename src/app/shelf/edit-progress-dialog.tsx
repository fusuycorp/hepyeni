"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { deleteMediaProgress, saveMediaProgress } from "@/lib/actions/progress";
import { useTranslations } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type {
  UserMediaProgressResponse,
  UserMediaProgressStatusOptions,
  UserMediaProgressUnitOptions,
} from "@/types/pocketbase-types";

interface EditProgressDialogProps {
  item: UserMediaProgressResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProgressDialog({
  item,
  open,
  onOpenChange,
}: EditProgressDialogProps) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const [status, setStatus] = useState<UserMediaProgressStatusOptions>(item.status);
  const [progressCurrent, setProgressCurrent] = useState<string>(
    item.progressCurrent !== undefined ? item.progressCurrent.toString() : "0",
  );
  const [progressTotal, setProgressTotal] = useState<string>(
    item.progressTotal !== undefined ? item.progressTotal.toString() : "",
  );
  const [progressUnit, setProgressUnit] = useState<UserMediaProgressUnitOptions>(
    item.progressUnit || "pages",
  );
  const [currentLabel, setCurrentLabel] = useState(item.currentLabel || "");
  const [notes, setNotes] = useState(item.notes || "");
  const [rating, setRating] = useState<number | undefined>(item.rating);
  const [isSharedWithCircles, setIsSharedWithCircles] = useState(
    item.isSharedWithCircles ?? true,
  );

  const handleSave = () => {
    startTransition(async () => {
      try {
        await saveMediaProgress({
          id: item.id,
          mediaType: item.mediaType,
          title: item.title,
          creator: item.creator,
          coverUrl: item.coverUrl,
          externalSource: item.externalSource,
          externalId: item.externalId,
          groupTitleId: item.groupTitle,
          status,
          progressCurrent: progressCurrent ? parseInt(progressCurrent, 10) : undefined,
          progressTotal: progressTotal ? parseInt(progressTotal, 10) : undefined,
          progressUnit,
          currentLabel: currentLabel || undefined,
          notes: notes || undefined,
          rating,
          isSharedWithCircles,
        });

        toast.success(t.shelf.progressSaved);
        onOpenChange(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t.common.error;
        toast.error(msg);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(t.shelf.deleteConfirm)) return;
    setIsDeleting(true);
    startTransition(async () => {
      try {
        await deleteMediaProgress(item.id);
        toast.success(t.shelf.progressDeleted);
        onOpenChange(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t.common.error;
        toast.error(msg);
      } finally {
        setIsDeleting(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {t.shelf.editProgress}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {item.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Header Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
            <MediaCover
              src={item.coverUrl}
              alt={item.title}
              size="sm"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
              {item.creator && (
                <p className="text-[11px] text-muted-foreground truncate">{item.creator}</p>
              )}
              <MediaBadge type={item.mediaType} size="sm" className="mt-1" />
            </div>
          </div>

          {/* Status Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t.media.mediaStatus}</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "in_progress", label: t.shelf.statusInProgress },
                { id: "plan_to_consume", label: t.shelf.statusPlanToConsume },
                { id: "completed", label: t.shelf.statusCompleted },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatus(s.id as UserMediaProgressStatusOptions)}
                  className={cn(
                    "py-2 px-2.5 rounded-lg border text-xs font-medium transition-all text-center",
                    status === s.id
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                      : "border-border/60 hover:bg-muted/40 text-muted-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress Counters */}
          {status !== "plan_to_consume" && (
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-card border border-border/60">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">{t.shelf.currentProgress}</Label>
                <Input
                  type="number"
                  value={progressCurrent}
                  onChange={(e) => setProgressCurrent(e.target.value)}
                  className="h-8 text-xs font-mono"
                  min={0}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">{t.shelf.totalProgress}</Label>
                <Input
                  type="number"
                  value={progressTotal}
                  onChange={(e) => setProgressTotal(e.target.value)}
                  placeholder="e.g. 350"
                  className="h-8 text-xs font-mono"
                  min={1}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">{t.shelf.currentUnit}</Label>
                <select
                  value={progressUnit}
                  onChange={(e) => setProgressUnit(e.target.value as UserMediaProgressUnitOptions)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="pages">{t.shelf.pages}</option>
                  <option value="chapters">{t.shelf.chapters}</option>
                  <option value="episodes">{t.shelf.episodes}</option>
                  <option value="minutes">{t.shelf.minutes}</option>
                  <option value="percent">{t.shelf.percent}</option>
                </select>
              </div>
            </div>
          )}

          {/* Current Chapter / Checkpoint Label */}
          <div className="space-y-1">
            <Label className="text-xs">{t.shelf.currentLabel}</Label>
            <Input
              value={currentLabel}
              onChange={(e) => setCurrentLabel(e.target.value)}
              placeholder="e.g. Season 2 Episode 4"
              className="h-8 text-xs"
            />
          </div>

          {/* Rating (if completed) */}
          {status === "completed" && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t.shelf.personalRating}</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(rating === star ? undefined : star)}
                    className="p-1 text-muted-foreground hover:text-amber-400 transition-colors"
                  >
                    <Star
                      className={cn(
                        "size-5",
                        rating && rating >= star
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/40",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Personal Journal Notes */}
          <div className="space-y-1">
            <Label className="text-xs">{t.shelf.personalNotes}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.shelf.notesPlaceholder}
              className="text-xs min-h-[60px] resize-none"
            />
          </div>

          {/* Circle Sharing */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">{t.shelf.shareWithCircles}</p>
              <p className="text-[11px] text-muted-foreground">{t.shelf.shareWithCirclesDesc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isSharedWithCircles}
              onClick={() => setIsSharedWithCircles(!isSharedWithCircles)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                isSharedWithCircles ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-2xs transition duration-200 ease-in-out",
                  isSharedWithCircles ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="destructive"
              size="xs"
              onClick={handleDelete}
              disabled={isDeleting || isPending}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" />
              <span>{t.shelf.deleteProgress}</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                {t.common.close}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isPending || isDeleting}
                className="gap-1.5"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                <span>{t.shelf.saveProgress}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
