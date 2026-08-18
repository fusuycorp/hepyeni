"use client";

import { useState, useTransition } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaBadge } from "@/components/media-badge";
import { MediaCover } from "@/components/media-cover";
import { MoodSelector } from "@/components/mood-selector";
import { useFeatureFlag } from "@/lib/flags/client";
import type { MoodType, PaceType } from "@/lib/moods";
import { saveMediaProgress } from "@/lib/actions/progress";
import { useTranslations } from "@/lib/i18n/client";
import { MEDIA_TYPES, type MediaType } from "@/lib/media-types";
import { cn } from "@/lib/utils";
import type { NormalizedSearchResult } from "@/lib/providers/types";
import type {
  TitlesMediaTypeOptions,
  UserMediaProgressStatusOptions,
  UserMediaProgressUnitOptions,
} from "@/types/pocketbase-types";

export function AddToShelfDialog() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<MediaType>("book");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedSearchResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<NormalizedSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Custom fallback mode
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customCreator, setCustomCreator] = useState("");

  // Progress form states
  const [status, setStatus] = useState<UserMediaProgressStatusOptions>("in_progress");
  const [progressCurrent, setProgressCurrent] = useState<string>("0");
  const [progressTotal, setProgressTotal] = useState<string>("");
  const [progressUnit, setProgressUnit] = useState<UserMediaProgressUnitOptions>("pages");
  const [currentLabel, setCurrentLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [isSharedWithCircles, setIsSharedWithCircles] = useState(true);
  const [selectedMoods, setSelectedMoods] = useState<MoodType[]>([]);
  const [selectedPace, setSelectedPace] = useState<PaceType | undefined>(undefined);

  const moodFeatureEnabled = useFeatureFlag("mood_pace_folksonomy");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const url = `/api/titles/search?mediaType=${encodeURIComponent(activeType)}&q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        results?: NormalizedSearchResult[];
        error?: string;
      };

      if (!res.ok) {
        toast.error(data.error || t.titles.searchFailed);
        setResults([]);
      } else {
        setResults(data.results || []);
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (item: NormalizedSearchResult) => {
    setSelectedMedia(item);
    if (activeType === "book") setProgressUnit("pages");
    else if (activeType === "tv") setProgressUnit("episodes");
    else if (activeType === "podcast" || activeType === "music") setProgressUnit("minutes");
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const titleToSave = isCustomMode ? customTitle : selectedMedia?.title;
        if (!titleToSave) return;

        const res = await saveMediaProgress({
          mediaType: activeType as TitlesMediaTypeOptions,
          title: titleToSave,
          creator: isCustomMode ? customCreator : selectedMedia?.creator,
          coverUrl: isCustomMode ? undefined : selectedMedia?.coverUrl,
          externalSource: isCustomMode ? "custom" : selectedMedia?.externalSource,
          externalId: isCustomMode ? `custom-${Date.now()}` : selectedMedia?.externalId,
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
            description: res.traceId ? `Referans Kodu: ${res.traceId}` : undefined,
          });
          return;
        }

        toast.success(t.shelf.progressSaved);
        setOpen(false);
        // Reset states
        setSelectedMedia(null);
        setResults([]);
        setQuery("");
        setCustomTitle("");
        setCustomCreator("");
        setSelectedMoods([]);
        setSelectedPace(undefined);
        setIsCustomMode(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t.common.error;
        toast.error(msg);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="w-full sm:w-auto gap-2 shadow-xs font-medium">
            <Plus className="size-4" />
            <span>{t.shelf.addToShelf}</span>
          </Button>
        }
      />
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {t.shelf.addToShelf}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t.shelf.pageSubtitle}
          </DialogDescription>
        </DialogHeader>

        {!selectedMedia && !isCustomMode ? (
          <div className="space-y-4 pt-2">
            {/* Media Type Tabs */}
            <div className="flex flex-wrap gap-1 bg-muted/60 p-1 rounded-xl border border-border/50">
              {MEDIA_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setActiveType(type);
                    setResults([]);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                    activeType === type
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.media[type]}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`${t.common.search} ${t.media[activeType]}...`}
                  className="pl-9 h-10 text-xs"
                  autoFocus
                />
              </div>
              <Button type="submit" size="sm" disabled={isSearching || !query.trim()} className="h-10 px-4">
                {isSearching ? <Loader2 className="size-4 animate-spin" /> : t.common.search}
              </Button>
            </form>

            {/* Search Results */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {results.map((item) => (
                <div
                  key={`${item.externalSource}-${item.externalId}`}
                  onClick={() => handleSelect(item)}
                  className="flex items-center gap-3 p-2 rounded-xl border border-border/60 hover:bg-muted/40 cursor-pointer transition-colors"
                >
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
                  </div>
                  <Button size="xs" variant="outline">
                    {t.common.open}
                  </Button>
                </div>
              ))}
            </div>

            {/* Custom Mode Toggle */}
            <div className="pt-2 border-t border-border/50 text-center">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setIsCustomMode(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t.titles.addCustomTitle}
              </Button>
            </div>
          </div>
        ) : (
          /* Progress & Details Configuration Form */
          <div className="space-y-4 pt-2 animate-in fade-in-50 duration-150">
            {selectedMedia && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                <MediaCover
                  src={selectedMedia.coverUrl}
                  alt={selectedMedia.title}
                  size="sm"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{selectedMedia.title}</p>
                  {selectedMedia.creator && (
                    <p className="text-[11px] text-muted-foreground truncate">{selectedMedia.creator}</p>
                  )}
                  <MediaBadge type={activeType} size="sm" className="mt-1" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setSelectedMedia(null)}
                  className="text-xs text-muted-foreground"
                >
                  {t.common.close}
                </Button>
              </div>
            )}

            {isCustomMode && (
              <div className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="space-y-1">
                  <Label className="text-xs">{t.titles.customTitleName}</Label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Crime and Punishment"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.titles.customCreatorLabel}</Label>
                  <Input
                    value={customCreator}
                    onChange={(e) => setCustomCreator(e.target.value)}
                    placeholder="e.g. Fyodor Dostoevsky"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Status Selector */}
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
                      "py-2 px-1.5 rounded-lg border text-xs font-medium transition-all text-center truncate",
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

            {/* Progress Metrics (for in_progress or completed) */}
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

            {/* Checkpoint Label */}
            <div className="space-y-1">
              <Label className="text-xs">{t.shelf.currentLabel}</Label>
              <Input
                value={currentLabel}
                onChange={(e) => setCurrentLabel(e.target.value)}
                placeholder="e.g. Chapter 6: The Great Gate"
                className="h-8 text-xs"
              />
            </div>

            {/* Personal Notes */}
            <div className="space-y-1">
              <Label className="text-xs">{t.shelf.personalNotes}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.shelf.notesPlaceholder}
                className="text-xs min-h-[60px] resize-none"
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

            {/* Circle Sharing Toggle */}
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

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedMedia(null);
                  setIsCustomMode(false);
                }}
              >
                {t.common.close}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending || (!selectedMedia && !customTitle.trim())}
                onClick={handleSave}
                className="gap-1.5"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                <span>{t.shelf.saveProgress}</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
