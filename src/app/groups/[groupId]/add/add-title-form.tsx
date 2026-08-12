"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MEDIA_TYPES, MEDIA_TYPE_LABELS, type MediaType } from "@/lib/media-types";
import { addTitle, searchTitles } from "@/lib/actions/titles";
import { isProviderAvailable } from "@/lib/providers";
import type { NormalizedSearchResult } from "@/lib/providers/types";

export function AddTitleForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [mediaType, setMediaType] = useState<MediaType>("book");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isAdding, startAdd] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSearch(async () => {
      try {
        setResults(await searchTitles(mediaType, query));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      }
    });
  }

  function handleAdd(result: NormalizedSearchResult) {
    setAddingId(result.externalId);
    setError(null);
    startAdd(async () => {
      try {
        await addTitle(groupId, mediaType, result);
        router.push(`/groups/${groupId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add title");
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
            <button
              key={type}
              type="button"
              disabled={!available}
              onClick={() => {
                setMediaType(type);
                setResults([]);
              }}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                mediaType === type
                  ? "bg-foreground text-background"
                  : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              } ${!available ? "opacity-40" : ""}`}
            >
              {MEDIA_TYPE_LABELS[type]}
              {!available && " (soon)"}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${MEDIA_TYPE_LABELS[mediaType].toLowerCase()}s…`}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {isSearching ? "…" : "Search"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="flex flex-col gap-3">
        {results.map((result) => (
          <li
            key={result.externalId}
            className="flex gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            {result.coverUrl ? (
              // Cover images come from many external providers (Google Books,
              // TMDB, Spotify, iTunes) — using <img> avoids maintaining a
              // remotePatterns allowlist across all of them.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.coverUrl}
                alt=""
                className="h-20 w-14 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="h-20 w-14 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
            )}
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <p className="text-sm font-medium">{result.title}</p>
                {result.creator && (
                  <p className="text-xs text-zinc-500">{result.creator}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleAdd(result)}
                disabled={isAdding && addingId === result.externalId}
                className="self-start rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-50 dark:border-zinc-700"
              >
                {isAdding && addingId === result.externalId
                  ? "Adding…"
                  : "Add"}
              </button>
            </div>
          </li>
        ))}
        {!isSearching && results.length === 0 && query && (
          <li className="text-sm text-zinc-500">No results yet.</li>
        )}
      </ul>
    </div>
  );
}
