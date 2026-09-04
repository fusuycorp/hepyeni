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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { MoodSelector } from "@/components/mood-selector";
import { useFeatureFlag } from "@/lib/flags/client";
import type { MoodType, PaceType } from "@/lib/moods";
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
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false);

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
  const [selectedMoods, setSelectedMoods] = useState<MoodType[]>(
    Array.isArray(item.moods) ? item.moods : [],
  );
  const [selectedPace, setSelectedPace] = useState<PaceType | undefined>(
    item.pace || undefined,
  );

  const moodFeatureEnabled = useFeatureFlag("mood_pace_folksonomy");

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveMediaProgress({
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
        moods: selectedMoods.length > 0 ? selectedMoods : undefined,
        pace: selectedPace,
        isSharedWithCircles,
      });

      if (!res.success) {
        toast.error(res.error, {
          description: res.traceId
            ? t.common.refCode.replace("{code}", res.traceId)
            : undefined,
        });
        return;
      }

      toast.success(t.shelf.progressSaved);
      onOpenChange(false);
    });
  };

  const handleConfirmDelete = () => {
    setConfirmDeleteDialogOpen(false);
    setIsDeleting(true);
    startTransition(async () => {
      try {
        const res = await deleteMediaProgress(item.id);
        if (!res.success) {
          toast.error(res.error, {
            description: res.traceId
              ? t.common.refCode.replace("{code}", res.traceId)
              : undefined,
          });
          return;
        }

        toast.success(t.shelf.progressDeleted);
        onOpenChange(false);
      } finally {
        setIsDeleting(false);
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {t.shelf.editProgress}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t.shelf.pageSubtitle}
            </DialogDescription>
          </DialogHeader>

          {/* Media Header Preview */}
          <div className="flex gap-3 items-center p-3 rounded-xl bg-muted/40 border border-border/50">
            <MediaCover src={item.coverUrl} alt={item.title} size="sm" />
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <MediaBadge type={item.mediaType} />
              </div>
              <h4 className="text-xs font-bold text-foreground truncate">
                {item.title}
              </h4>
              {item.creator && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {item.creator}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* Status Select */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t.shelf.quickUpdate}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {(
                  [
                    "in_progress",
                    "completed",
                    "plan_to_consume",
                    "on_hold",
                    "dropped",
                  ] as UserMediaProgressStatusOptions[]
                ).map((s) => {
                  const isSelected = status === s;
                  const labelMap: Record<UserMediaProgressStatusOptions, string> = {
                    in_progress: t.shelf.statusInProgress,
                    completed: t.shelf.statusCompleted,
                    plan_to_consume: t.shelf.statusPlanToConsume,
                    on_hold: t.shelf.statusOnHold,
                    dropped: t.shelf.statusDropped,
                  };
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "p-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer truncate",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                          : "bg-background border-border/70 hover:bg-muted text-muted-foreground",
                      )}
                    >
                      {labelMap[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progress Counters */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t.shelf.currentProgress}</Label>
                <Input
                  type="number"
                  min="0"
                  value={progressCurrent}
                  onChange={(e) => setProgressCurrent(e.target.value)}
                  placeholder="0"
                  className="h-8 text-base md:text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.shelf.totalProgress}</Label>
                <Input
                  type="number"
                  min="1"
                  value={progressTotal}
                  onChange={(e) => setProgressTotal(e.target.value)}
                  placeholder={t.shelf.targetUnitsPlaceholder}
                  className="h-8 text-base md:text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.shelf.currentUnit}</Label>
                <select
                  value={progressUnit}
                  onChange={(e) =>
                    setProgressUnit(e.target.value as UserMediaProgressUnitOptions)
                  }
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-base md:text-sm"
                >
                  <option value="pages">{t.shelf.pages}</option>
                  <option value="chapters">{t.shelf.chapters}</option>
                  <option value="episodes">{t.shelf.episodes}</option>
                  <option value="percent">{t.shelf.percent}</option>
                  <option value="minutes">{t.shelf.minutes}</option>
                </select>
              </div>
            </div>

            {/* Current Chapter/Track Label */}
            <div className="space-y-1">
              <Label className="text-xs">{t.shelf.currentLabel}</Label>
              <Input
                value={currentLabel}
                onChange={(e) => setCurrentLabel(e.target.value)}
                placeholder={t.shelf.currentLabelPlaceholder}
                className="h-8 text-base md:text-sm"
              />
            </div>

            {/* Rating Stars */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t.shelf.personalRating}</Label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={t.reviews.starAriaLabel.replace("{n}", String(star))}
                    onClick={() => setRating(rating === star ? undefined : star)}
                    className="p-1 hover:scale-110 transition-transform cursor-pointer"
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
                {rating && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setRating(undefined)}
                    className="text-[10px] text-muted-foreground ml-2 h-6"
                  >
                    {t.common.cancel}
                  </Button>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">{t.shelf.personalNotes}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.shelf.notesPlaceholder}
                className="text-base md:text-sm min-h-[60px] resize-none"
              />
            </div>

            {/* Mood & Pace Selector */}
            {moodFeatureEnabled && (
              <div className="p-3 rounded-xl bg-card border border-border/60">
                <MoodSelector
                  selectedMoods={selectedMoods}
                  onChangeMoods={setSelectedMoods}
                  selectedPace={selectedPace}
                  onChangePace={setSelectedPace}
                />
              </div>
            )}

            {/* Privacy Checkbox */}
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isSharedWithCircles}
                onChange={(e) => setIsSharedWithCircles(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary size-4"
              />
              <span>{t.shelf.shareWithCircles}</span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeleteDialogOpen(true)}
                disabled={isPending || isDeleting}
                className="text-destructive hover:bg-destructive/10 gap-1.5 text-xs"
              >
                <Trash2 className="size-3.5" />
                <span>{t.common.delete}</span>
              </Button>

              <div className="flex gap-2">
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
                  disabled={isPending || isDeleting}
                  onClick={handleSave}
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

      {/* Accessible Base UI AlertDialog for Deletion Confirmation */}
      <AlertDialog open={confirmDeleteDialogOpen} onOpenChange={setConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.confirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.shelf.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
