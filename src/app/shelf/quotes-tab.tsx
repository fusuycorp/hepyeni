"use client";

import { useState, useMemo, useTransition } from "react";
import { Quote, Tag, Sparkles, Filter } from "lucide-react";
import { toast } from "sonner";
import { QuoteCard } from "@/components/quote-card";
import { AddQuoteDialog } from "@/components/add-quote-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/client";
import { deleteQuote } from "@/lib/actions/marginalia";
import { cn } from "@/lib/utils";
import type {
  ShelfQuotesResponse,
  UserMediaProgressResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

interface QuotesTabProps {
  initialQuotes?: ShelfQuotesResponse<{
    user?: UsersResponse;
    progressItem?: UserMediaProgressResponse;
  }>[];
  shelfItems?: UserMediaProgressResponse[];
  currentUserId?: string;
  isAdmin?: boolean;
}

export function QuotesTab({
  initialQuotes = [],
  shelfItems = [],
  currentUserId,
  isAdmin,
}: QuotesTabProps) {
  const t = useTranslations();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [selectedMediaType, setSelectedMediaType] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [, startTransition] = useTransition();

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const q of quotes) {
      if (Array.isArray(q.tags)) {
        for (const tag of q.tags) {
          if (tag && tag.trim()) {
            set.add(tag.trim().toLowerCase());
          }
        }
      }
    }
    return Array.from(set).sort();
  }, [quotes]);

  // Filter quotes by mediaType and tag
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      if (selectedMediaType !== "all" && q.mediaType !== selectedMediaType) {
        return false;
      }
      if (selectedTag !== "all") {
        if (!Array.isArray(q.tags)) return false;
        const normalized = q.tags.map((tag) => tag.toLowerCase());
        if (!normalized.includes(selectedTag.toLowerCase())) return false;
      }
      return true;
    });
  }, [quotes, selectedMediaType, selectedTag]);

  const handleDelete = async (quoteId: string) => {
    startTransition(async () => {
      const res = await deleteQuote(quoteId);
      if (!res.success) {
        toast.error(res.error, {
          description: res.traceId ? `Ref: ${res.traceId}` : undefined,
        });
        return;
      }
      setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
      toast.success(t.marginalia.quoteDeleted);
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Media Type Filter */}
          <div className="flex items-center gap-1">
            <select
              value={selectedMediaType}
              onChange={(e) => setSelectedMediaType(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground shadow-2xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">{t.marginalia.allMedia}</option>
              <option value="book">{t.media.book}</option>
              <option value="movie">{t.media.movie}</option>
              <option value="tv">{t.media.tv}</option>
              <option value="music">{t.media.music}</option>
              <option value="podcast">{t.media.podcast}</option>
            </select>
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground shadow-2xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">{t.marginalia.allTags}</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(selectedMediaType !== "all" || selectedTag !== "all") && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSelectedMediaType("all");
                setSelectedTag("all");
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              {t.common.cancel}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <AddQuoteDialog
            shelfItems={shelfItems}
            onSuccess={() => {
              // Trigger a soft refresh or the revalidatePath will handle it on next navigation
              window.location.reload();
            }}
          />
        </div>
      </div>

      {/* Quick Tag Pills (if available) */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          <button
            type="button"
            onClick={() => setSelectedTag("all")}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 border",
              selectedTag === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                : "bg-muted/50 text-muted-foreground hover:text-foreground border-border/50",
            )}
          >
            {t.marginalia.allTags}
          </button>
          {allTags.slice(0, 10).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(selectedTag === tag ? "all" : tag)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 border flex items-center gap-1",
                selectedTag === tag
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground border-border/50",
              )}
            >
              <Tag className="size-2.5 opacity-70" />
              <span>#{tag}</span>
            </button>
          ))}
        </div>
      )}

      {/* Quotes Gallery Grid */}
      {filteredQuotes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border/70 bg-card/40 space-y-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mx-auto">
            <Quote className="size-6 text-primary/70 rotate-180" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <p className="text-sm font-medium text-foreground">
              {quotes.length === 0 ? t.marginalia.emptyQuotes : t.common.noItemsFound}
            </p>
          </div>
          {quotes.length === 0 && (
            <div className="pt-2">
              <AddQuoteDialog shelfItems={shelfItems} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
