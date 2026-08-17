"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Search, Plus, Loader2, Sparkles, PenTool, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { MEDIA_TYPES, type MediaType } from "@/lib/media-types";
import { addTitle, addCustomTitle } from "@/lib/actions/titles";
import { isProviderAvailable } from "@/lib/providers";
import type { NormalizedSearchResult } from "@/lib/providers/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";

interface AddTitleFormProps {
  groupId: string;
  onSuccess?: () => void;
  isModal?: boolean;
}

export function AddTitleForm({
  groupId,
  onSuccess,
  isModal = false,
}: AddTitleFormProps) {
  const router = useRouter();
  const t = useTranslations();
  const [mediaType, setMediaType] = useState<MediaType>("book");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isAdding, startAdd] = useTransition();

  // Custom media creation state
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customCreator, setCustomCreator] = useState("");
  const [customCoverUrl, setCustomCoverUrl] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    startSearch(async () => {
      try {
        const url = `/api/titles/search?mediaType=${encodeURIComponent(mediaType)}&q=${encodeURIComponent(cleanQuery)}`;
        const res = await fetch(url);
        const data = (await res.json()) as {
          results?: NormalizedSearchResult[];
          error?: string;
          traceId?: string;
        };

        if (!res.ok) {
          toast.error(data.error || t.titles.searchFailed);
          setResults([]);
        } else {
          setResults(data.results || []);
        }
        setHasSearched(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.titles.searchFailed);
        setResults([]);
        setHasSearched(true);
      }
    });
  }

  function handleAdd(result: NormalizedSearchResult) {
    setAddingId(result.externalId);
    startAdd(async () => {
      try {
        await addTitle(groupId, mediaType, result);
        toast.success(t.titles.addedToBacklog.replace("{title}", result.title));
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/groups/${groupId}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.titles.addFailed);
        setAddingId(null);
      }
    });
  }

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = customTitle.trim();
    if (!cleanTitle) return;

    startAdd(async () => {
      try {
        await addCustomTitle(groupId, mediaType, {
          title: cleanTitle,
          creator: customCreator.trim() || undefined,
          coverUrl: customCoverUrl.trim() || undefined,
          description: customDescription.trim() || undefined,
        });
        toast.success(t.titles.addedToBacklog.replace("{title}", cleanTitle));
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/groups/${groupId}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.titles.addFailed);
      }
    });
  }

  const getCreatorLabel = () => {
    switch (mediaType) {
      case "book":
        return t.titles.authorLabel;
      case "movie":
      case "tv":
        return t.titles.directorLabel;
      case "music":
        return t.titles.artistLabel;
      case "podcast":
        return t.titles.hostLabel;
    }
  };

  return (
    <div className={cn("flex flex-col gap-5", isModal && "gap-4")}>
      {/* Media Type Selector Chips & Custom Mode Switch */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {MEDIA_TYPES.map((type) => {
            const available = isProviderAvailable(type);
            const active = mediaType === type;
            return (
              <button
                key={type}
                type="button"
                disabled={!available}
                onClick={() => {
                  setMediaType(type);
                  setResults([]);
                  setHasSearched(false);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : available
                    ? "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    : "bg-muted/40 text-muted-foreground/40 border-transparent cursor-not-allowed"
                )}
              >
                <MediaBadge
                  type={type}
                  size="sm"
                  className="bg-transparent border-0 p-0 text-inherit"
                />
                {!available && <span className="text-[10px] opacity-70">{t.media.comingSoon}</span>}
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          variant={isCustomMode ? "secondary" : "outline"}
          size="xs"
          className="text-xs gap-1.5 shrink-0"
          onClick={() => {
            setIsCustomMode(!isCustomMode);
            if (!isCustomMode) {
              setCustomTitle(query);
            }
          }}
        >
          {isCustomMode ? (
            <>
              <ArrowLeft className="size-3" />
              <span>{t.titles.backToSearch}</span>
            </>
          ) : (
            <>
              <PenTool className="size-3" />
              <span>{t.titles.addCustomTitle}</span>
            </>
          )}
        </Button>
      </div>

      {isCustomMode ? (
        /* Custom Media Creation Form */
        <Card className="border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 sm:p-5">
            <form onSubmit={handleAddCustom} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <PenTool className="size-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-foreground">
                      {t.titles.addCustomTitle}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {t.titles.cantFindMediaDesc}
                    </p>
                  </div>
                </div>
                <MediaBadge type={mediaType} size="sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {/* Form fields (2 cols) */}
                <div className="sm:col-span-2 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.titles.customTitleName} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      required
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder={t.titles.customTitlePlaceholder}
                      maxLength={300}
                      className="text-xs sm:text-sm h-10"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {getCreatorLabel()}
                    </label>
                    <Input
                      value={customCreator}
                      onChange={(e) => setCustomCreator(e.target.value)}
                      placeholder={`${getCreatorLabel()}...`}
                      maxLength={300}
                      className="text-xs sm:text-sm h-10"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.titles.coverUrlLabel}
                    </label>
                    <Input
                      type="url"
                      value={customCoverUrl}
                      onChange={(e) => setCustomCoverUrl(e.target.value)}
                      placeholder={t.titles.coverUrlPlaceholder}
                      className="text-xs sm:text-sm h-10"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.titles.descriptionLabel}
                    </label>
                    <textarea
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder={t.titles.descriptionPlaceholder}
                      maxLength={1000}
                      rows={2}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-2xs outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    />
                  </div>
                </div>

                {/* Cover Live Preview (1 col) */}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-muted/30 border border-dashed border-border/70 text-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t.titles.previewCover}
                  </span>
                  <div className="w-24 aspect-[2/3] rounded-lg overflow-hidden ring-1 ring-border shadow-xs bg-muted/60 flex items-center justify-center">
                    {customCoverUrl && /^https?:\/\//i.test(customCoverUrl.trim()) ? (
                      <MediaCover
                        src={customCoverUrl.trim()}
                        alt={customTitle || "Custom cover"}
                        size="md"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground/60 gap-1 p-2">
                        <ImageIcon className="size-6" />
                        <span className="text-[9px] leading-tight">No Cover</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-foreground line-clamp-1 max-w-full px-1">
                    {customTitle || t.titles.customTitleName}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCustomMode(false)}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAdding || !customTitle.trim()}
                  className="font-semibold gap-1.5"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>{t.titles.addingCustom}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5" />
                      <span>{t.titles.addCustomButton}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search Input Bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.titles.searchPlaceholder}
                className="pl-9 text-xs sm:text-sm h-10"
              />
            </div>
            <Button
              type="submit"
              size="default"
              disabled={isSearching || !query.trim()}
              className="shrink-0 h-10 px-4 font-semibold"
            >
              {isSearching ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{t.titles.searching}</span>
                </>
              ) : (
                <>
                  <span>{t.common.search}</span>
                </>
              )}
            </Button>
          </form>

          {/* Results Section */}
          <div className={cn(isModal && "max-h-[50vh] sm:max-h-[55vh] overflow-y-auto pr-1 -mr-1")}>
            {results.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{results.length} {t.titles.resultsFound}</span>
                  <MediaBadge type={mediaType} size="sm" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.map((result) => {
                    const isItemAdding = isAdding && addingId === result.externalId;
                    return (
                      <Card
                        key={result.externalId}
                        className="border-border/70 hover:border-primary/40 transition-all duration-200 shadow-2xs"
                      >
                        <CardContent className="p-3 sm:p-4 flex gap-3 h-full">
                          <MediaCover
                            src={result.coverUrl}
                            alt={result.title}
                            size="md"
                            className="shrink-0"
                          />
                          <div className="flex flex-1 flex-col justify-between min-w-0">
                            <div className="space-y-1">
                              <h4 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                                {result.title}
                              </h4>
                              {result.creator && (
                                <p className="text-xs text-muted-foreground font-medium line-clamp-1">
                                  {result.creator}
                                </p>
                              )}
                            </div>

                            <Button
                              type="button"
                              variant="secondary"
                              size="xs"
                              className="self-start mt-2 font-medium gap-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                              onClick={() => handleAdd(result)}
                              disabled={isItemAdding}
                            >
                              {isItemAdding ? (
                                <>
                                  <Loader2 className="size-3 animate-spin" />
                                  <span>{t.titles.adding}</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="size-3" />
                                  <span>{t.titles.addToCircle}</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {!isSearching && hasSearched && results.length === 0 && (
              <div className="space-y-4">
                <EmptyState
                  icon={Search}
                  title={t.titles.noResultsTitle}
                  description={t.titles.noResultsDesc.replace("{type}", t.media[mediaType])}
                />
                <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-card border border-border/80 text-center gap-2">
                  <p className="text-xs font-semibold text-foreground">
                    {t.titles.cantFindMedia}
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-sm">
                    {t.titles.cantFindMediaDesc}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 gap-1.5 font-semibold text-xs"
                    onClick={() => {
                      setIsCustomMode(true);
                      setCustomTitle(query);
                    }}
                  >
                    <PenTool className="size-3.5" />
                    <span>{t.titles.addCustomTitle}</span>
                  </Button>
                </div>
              </div>
            )}

            {!hasSearched && (
              <EmptyState
                icon={Sparkles}
                title={t.titles.proposeTitle}
                description={t.titles.proposeSubtitle}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

