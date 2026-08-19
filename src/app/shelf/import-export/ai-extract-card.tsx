"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MediaBadge } from "@/components/media-badge";
import { useTranslations } from "@/lib/i18n/client";
import { extractTitlesFromDump, proposeExtractedTitles } from "@/lib/actions/llm-extract";
import { batchImportProgress } from "@/lib/actions/import-export";
import { MAX_INPUT_CHARS } from "@/lib/llm/validate";
import type { ExtractResult } from "@/lib/llm/types";
import type { NormalizedImportItem } from "@/lib/importers";
import type { MediaType } from "@/lib/media-types";

const USE_AS_IS = -1;

export function AiExtractCard({ onBack }: { onBack: () => void }) {
  const t = useTranslations();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const charCount = text.length;

  function handleExtract() {
    if (!text.trim()) return;
    startTransition(async () => {
      const res = await extractTitlesFromDump(text);
      if (!res.success) {
        toast.error(t.importExport.extractError.replace("{error}", res.error));
        return;
      }
      if (!res.data || res.data.candidates.length === 0) {
        toast.error(t.importExport.noCandidates);
        return;
      }
      setResult(res.data);
    });
  }

  if (result) {
    return <AiExtractPreview result={result} onBack={() => setResult(null)} />;
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/50 bg-card/40 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            {t.importExport.fromTextTitle}
          </h2>
          <p className="text-xs text-muted-foreground">{t.importExport.fromTextDesc}</p>
        </div>
      </div>

      <Textarea
        value={text}
        maxLength={MAX_INPUT_CHARS}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.importExport.pastePlaceholder}
        className="min-h-40"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t.importExport.charCount
            .replace("{count}", String(charCount))
            .replace("{max}", String(MAX_INPUT_CHARS))}
        </span>
        <Button onClick={handleExtract} disabled={isPending || !text.trim()}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t.importExport.extracting}
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              {t.importExport.extractButton}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function AiExtractPreview({
  result,
  onBack,
}: {
  result: ExtractResult;
  onBack: () => void;
}) {
  const t = useTranslations();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(result.candidates.map((_, i) => i)),
  );
  const [matchChoice, setMatchChoice] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    result.candidates.forEach((c, i) => {
      init[i] = c.matches.length > 0 ? 0 : USE_AS_IS;
    });
    return init;
  });
  const [destination, setDestination] = useState<"group" | "shelf">("group");
  const [groupId, setGroupId] = useState<string>(result.userGroups[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  function toggleRow(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function handleAdd() {
    const indices = [...selected].sort((a, b) => a - b);
    if (indices.length === 0) {
      toast.error(t.importExport.noItemsSelected);
      return;
    }

    if (destination === "shelf") {
      const items: NormalizedImportItem[] = indices.map((i) => {
        const c = result.candidates[i].raw;
        return {
          title: c.title,
          creator: c.creator,
          mediaType: c.mediaType as MediaType,
          status: "plan_to_consume",
          rating: c.rating,
        };
      });
      startTransition(async () => {
        const res = await batchImportProgress(items);
        if (!res.success) {
          toast.error(t.importExport.addedFailed);
          return;
        }
        toast.success(
          t.importExport.addedSuccess
            .replace("{added}", String(res.data?.importedCount ?? 0))
            .replace("{skipped}", String(res.data?.skippedCount ?? 0)),
        );
        onBack();
      });
      return;
    }

    if (!groupId) {
      toast.error(t.importExport.featureDisabled);
      return;
    }
    const entries = indices.map((i) => {
      const c = result.candidates[i];
      const choice = matchChoice[i] ?? USE_AS_IS;
      if (choice !== USE_AS_IS && c.matches[choice]) {
        return { mediaType: c.raw.mediaType as MediaType, match: c.matches[choice] };
      }
      return {
        mediaType: c.raw.mediaType as MediaType,
        custom: { title: c.raw.title, creator: c.raw.creator },
      };
    });
    startTransition(async () => {
      const res = await proposeExtractedTitles(groupId, entries);
      if (!res.success) {
        toast.error(t.importExport.addedFailed);
        return;
      }
      toast.success(
        t.importExport.addedSuccess
          .replace("{added}", String(res.data?.addedCount ?? 0))
          .replace("{skipped}", String(res.data?.skippedCount ?? 0)),
      );
      onBack();
    });
  }

  const selectedCount = selected.size;
  const groupDisabled = destination === "group" && result.userGroups.length === 0;

  return (
    <div className="space-y-4 rounded-xl border border-border/50 bg-card/40 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            aria-label={t.common.back}
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {t.importExport.previewTitle}
            </h2>
            <p className="text-xs text-muted-foreground">{t.importExport.previewSubtitle}</p>
          </div>
        </div>
        {result.dropped > 0 && (
          <span className="text-xs text-muted-foreground">
            {t.importExport.droppedNote.replace("{count}", String(result.dropped))}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {result.candidates.map((c, i) => (
          <div
            key={`${c.raw.mediaType}:${c.raw.title}:${i}`}
            className="rounded-lg border border-border/50 p-3"
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleRow(i)}
                aria-label={t.common.confirm}
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-border"
              >
                {selected.has(i) ? <Check className="size-3.5 text-primary" /> : null}
              </button>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <MediaBadge type={c.raw.mediaType} />
                  <span className="truncate font-medium">{c.raw.title}</span>
                  {c.raw.creator && (
                    <span className="truncate text-xs text-muted-foreground">
                      {c.raw.creator}
                    </span>
                  )}
                  {c.raw.rating != null && (
                    <span className="text-xs text-amber-600">★ {c.raw.rating}</span>
                  )}
                </div>
                {c.raw.reason && (
                  <p className="text-xs text-muted-foreground">{c.raw.reason}</p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {c.matches.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t.importExport.matchNone}
                    </span>
                  )}
                  {c.matches.map((m, mi) => (
                    <MatchOption
                      key={m.externalId}
                      label={`${m.title}${m.creator ? ` — ${m.creator}` : ""}`}
                      active={matchChoice[i] === mi}
                      onClick={() =>
                        setMatchChoice((prev) => ({ ...prev, [i]: mi }))
                      }
                    />
                  ))}
                  <MatchOption
                    label={t.importExport.matchUseAsIs}
                    active={matchChoice[i] === USE_AS_IS}
                    onClick={() =>
                      setMatchChoice((prev) => ({ ...prev, [i]: USE_AS_IS }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t.importExport.targetDestination}
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="dest"
                checked={destination === "group"}
                onChange={() => setDestination("group")}
              />
              {t.importExport.targetGroup}
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="dest"
                checked={destination === "shelf"}
                onChange={() => setDestination("shelf")}
              />
              {t.importExport.targetShelf}
            </label>
          </div>
          {destination === "group" && (
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              {result.userGroups.length === 0 && <option value="">—</option>}
              {result.userGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          {groupDisabled && (
            <p className="text-xs text-muted-foreground">{t.importExport.selectGroup}</p>
          )}
        </div>

        <Button
          onClick={handleAdd}
          disabled={isPending || selectedCount === 0 || groupDisabled}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t.importExport.adding}
            </>
          ) : (
            <>
              <Check className="size-4" />
              {t.importExport.addSelected.replace("{count}", String(selectedCount))}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function MatchOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`max-w-full truncate rounded-full border px-2.5 py-1 text-xs transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-foreground/30"
      }`}
    >
      {label}
    </button>
  );
}