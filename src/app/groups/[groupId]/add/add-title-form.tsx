"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { MEDIA_TYPES, MEDIA_TYPE_LABELS, type MediaType } from "@/lib/media-types";
import { addTitle, searchTitles } from "@/lib/actions/titles";
import { isProviderAvailable } from "@/lib/providers";
import type { NormalizedSearchResult } from "@/lib/providers/types";
import { cn } from "@/lib/utils";

export function AddTitleForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [mediaType, setMediaType] = useState<MediaType>("book");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isAdding, startAdd] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    startSearch(async () => {
      try {
        const data = await searchTitles(mediaType, query);
        setResults(data);
        setHasSearched(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Search failed");
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
        toast.success(`Added "${result.title}" to backlog!`);
        router.push(`/groups/${groupId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add title");
        setAddingId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Media Type Selector Chips */}
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
              {!available && <span className="text-[10px] opacity-70">(soon)</span>}
            </button>
          );
        })}
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${MEDIA_TYPE_LABELS[mediaType].toLowerCase()}s by title, author, artist…`}
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
              <span>Searching…</span>
            </>
          ) : (
            <>
              <span>Search</span>
            </>
          )}
        </Button>
      </form>

      {/* Results Section */}
      <div>
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Found {results.length} results</span>
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
                              <span>Adding…</span>
                            </>
                          ) : (
                            <>
                              <Plus className="size-3" />
                              <span>Add to Backlog</span>
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
          <EmptyState
            icon={Search}
            title="No matching titles found"
            description={`Try adjusting your search keywords for ${MEDIA_TYPE_LABELS[mediaType].toLowerCase()}s.`}
          />
        )}

        {!hasSearched && (
          <EmptyState
            icon={Sparkles}
            title="Find & Propose Media"
            description={`Search Google Books, TMDB, Spotify, or Podcasts to add titles to this circle's voting queue.`}
          />
        )}
      </div>
    </div>
  );
}
