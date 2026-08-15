"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { MediaCover } from "@/components/media-cover";
import { MEDIA_TYPES, MEDIA_TYPE_LABELS, type MediaType } from "@/lib/media-types";
import { addTitle, searchTitles } from "@/lib/actions/titles";
import { isProviderAvailable } from "@/lib/providers";
import type { NormalizedSearchResult } from "@/lib/providers/types";

export function AddTitleForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [mediaType, setMediaType] = useState<MediaType>("book");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedSearchResult[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isAdding, startAdd] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => {
      try {
        setResults(await searchTitles(mediaType, query));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      }
    });
  }

  function handleAdd(result: NormalizedSearchResult) {
    setAddingId(result.externalId);
    startAdd(async () => {
      try {
        await addTitle(groupId, mediaType, result);
        router.push(`/groups/${groupId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add title");
        setAddingId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {MEDIA_TYPES.map((type) => {
          const available = isProviderAvailable(type);
          return (
            <Button
              key={type}
              type="button"
              size="sm"
              variant={mediaType === type ? "default" : "outline"}
              disabled={!available}
              onClick={() => {
                setMediaType(type);
                setResults([]);
              }}
              className="shrink-0 rounded-full"
            >
              {MEDIA_TYPE_LABELS[type]}
              {!available && " (soon)"}
            </Button>
          );
        })}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${MEDIA_TYPE_LABELS[mediaType].toLowerCase()}s…`}
        />
        <Button type="submit" disabled={isSearching || !query.trim()}>
          {isSearching ? "…" : "Search"}
        </Button>
      </form>

      <ul className="flex flex-col gap-3">
        {results.map((result) => (
          <li key={result.externalId}>
            <Card size="sm" className="flex-row gap-3 px-3">
              <MediaCover src={result.coverUrl} size="md" />
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <p className="text-sm font-medium">{result.title}</p>
                  {result.creator && (
                    <p className="text-xs text-muted-foreground">
                      {result.creator}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="self-start"
                  onClick={() => handleAdd(result)}
                  disabled={isAdding && addingId === result.externalId}
                >
                  {isAdding && addingId === result.externalId
                    ? "Adding…"
                    : "Add"}
                </Button>
              </div>
            </Card>
          </li>
        ))}
        {!isSearching && results.length === 0 && query && (
          <EmptyState title="No results yet" />
        )}
      </ul>
    </div>
  );
}
