"use client";

import { useState, useTransition } from "react";
import { Quote, Plus, Loader2, BookOpen } from "lucide-react";
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
import { useTranslations } from "@/lib/i18n/client";
import { addQuote, type AddQuoteInput } from "@/lib/actions/marginalia";
import type { UserMediaProgressResponse } from "@/types/pocketbase-types";

interface AddQuoteDialogProps {
  shelfItems?: UserMediaProgressResponse[];
  initialTitleName?: string;
  initialMediaType?: string;
  initialProgressItemId?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddQuoteDialog({
  shelfItems = [],
  initialTitleName = "",
  initialMediaType = "",
  initialProgressItemId = "",
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSuccess,
}: AddQuoteDialogProps) {
  const t = useTranslations();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  // Form State
  const [selectedProgressId, setSelectedProgressId] = useState(initialProgressItemId);
  const [titleName, setTitleName] = useState(initialTitleName);
  const [mediaType, setMediaType] = useState(initialMediaType);
  const [quoteText, setQuoteText] = useState("");
  const [attribution, setAttribution] = useState("");
  const [tags, setTags] = useState("");
  const [isSharedWithCircles, setIsSharedWithCircles] = useState(true);

  // When a shelf item is chosen from dropdown, sync title & mediaType
  const handleSelectShelfItem = (progressId: string) => {
    setSelectedProgressId(progressId);
    if (!progressId) return;
    const item = shelfItems.find((s) => s.id === progressId);
    if (item) {
      setTitleName(item.title);
      setMediaType(item.mediaType);
      if (item.currentLabel && !attribution) {
        setAttribution(item.currentLabel);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteText.trim()) {
      toast.error(t.marginalia.quoteTextLabel);
      return;
    }
    if (!titleName.trim()) {
      toast.error(t.marginalia.titleLabel);
      return;
    }

    startTransition(async () => {
      const input: AddQuoteInput = {
        titleName: titleName.trim(),
        quoteText: quoteText.trim(),
        attribution: attribution.trim() || undefined,
        mediaType: mediaType.trim() || undefined,
        progressItem: selectedProgressId || undefined,
        tags: tags.trim() || undefined,
        isSharedWithCircles: isSharedWithCircles,
      };

      const res = await addQuote(input);
      if (!res.success) {
        toast.error(res.error, {
          description: res.traceId ? t.common.refCode.replace("{code}", res.traceId) : undefined,
        });
        return;
      }

      toast.success(t.marginalia.quoteSaved);
      // Reset form
      setQuoteText("");
      setAttribution("");
      setTags("");
      setOpen(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm" className="gap-1.5 font-medium shadow-xs text-xs">
              <Plus className="size-3.5" />
              <span>{t.marginalia.captureQuote}</span>
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-lg max-h-[90dvh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Quote className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
                {t.marginalia.dialogTitle}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {t.marginalia.dialogSubtitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 overflow-y-auto flex-1 px-0.5">
          {/* Optional: Link to Shelf Item */}
          {shelfItems.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <BookOpen className="size-3" />
                {t.marginalia.linkToShelfItem}
              </Label>
              <select
                value={selectedProgressId}
                onChange={(e) => handleSelectShelfItem(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{t.marginalia.noLinkedMedia}</option>
                {shelfItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.mediaType})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title & Media Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">
                {t.marginalia.titleLabel} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={titleName}
                onChange={(e) => setTitleName(e.target.value)}
                placeholder={t.marginalia.titlePlaceholder}
                maxLength={200}
                required
                className="text-base md:text-sm h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t.marginalia.filterByMedia}
              </Label>
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-base md:text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{t.marginalia.allMedia}</option>
                <option value="book">{t.media.book}</option>
                <option value="movie">{t.media.movie}</option>
                <option value="tv">{t.media.tv}</option>
                <option value="music">{t.media.music}</option>
                <option value="podcast">{t.media.podcast}</option>
              </select>
            </div>
          </div>

          {/* Quote Text */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">
                {t.marginalia.quoteTextLabel} <span className="text-destructive">*</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {t.marginalia.characterCount
                  .replace("{current}", String(quoteText.length))
                  .replace("{max}", "3000")}
              </span>
            </div>
            <Textarea
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              placeholder={t.marginalia.quotePlaceholder}
              maxLength={3000}
              rows={4}
              required
              className="text-base md:text-sm resize-y font-serif leading-relaxed"
            />
          </div>

          {/* Attribution & Checkpoint */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {t.marginalia.attributionLabel}
            </Label>
            <Input
              value={attribution}
              onChange={(e) => setAttribution(e.target.value)}
              placeholder={t.marginalia.attributionPlaceholder}
              maxLength={200}
              className="text-base md:text-sm h-9"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {t.marginalia.tagsLabel}
            </Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t.marginalia.tagsPlaceholder}
              className="text-base md:text-sm h-9"
            />
          </div>

          {/* Privacy Scope Toggle */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">
                {t.marginalia.shareWithCircles}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t.marginalia.shareWithCirclesDesc}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label={t.marginalia.shareWithCircles}
              aria-checked={isSharedWithCircles}
              onClick={() => setIsSharedWithCircles(!isSharedWithCircles)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSharedWithCircles ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isSharedWithCircles ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !quoteText.trim() || !titleName.trim()}
              className="gap-1.5"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>{isPending ? t.common.saving : t.marginalia.captureQuote}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
