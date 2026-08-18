"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckSquare,
  Square,
  Search,
  ChevronLeft,
  ChevronRight,
  Star,
  Clock,
  CheckCircle2,
  Bookmark,
  PauseCircle,
  XCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { MediaBadge } from "@/components/media-badge";
import { batchImportProgress } from "@/lib/actions/import-export";
import { useTranslations } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { NormalizedImportItem } from "@/lib/importers";
import type { UserMediaProgressStatusOptions } from "@/types/pocketbase-types";

interface ImportPreviewTableProps {
  items: NormalizedImportItem[];
  onSuccess?: () => void;
}

const ITEMS_PER_PAGE = 20;

export function ImportPreviewTable({ items: initialItems, onSuccess }: ImportPreviewTableProps) {
  const t = useTranslations();
  const router = useRouter();

  const [items, setItems] = useState<NormalizedImportItem[]>(initialItems);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(initialItems.map((_, i) => i)),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Filter items by search query
  const filteredItemsWithIndices = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return items.map((item, index) => ({ item, index }));
    }
    return items
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          item.title.toLowerCase().includes(query) ||
          (item.creator && item.creator.toLowerCase().includes(query)),
      );
  }, [items, searchQuery]);

  const totalPages = Math.ceil(filteredItemsWithIndices.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredItemsWithIndices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItemsWithIndices, safeCurrentPage]);

  // Select all / Deselect all handlers
  const allFilteredSelected = useMemo(() => {
    if (filteredItemsWithIndices.length === 0) return false;
    return filteredItemsWithIndices.every(({ index }) => selectedIndices.has(index));
  }, [filteredItemsWithIndices, selectedIndices]);

  const toggleSelectAll = () => {
    const next = new Set(selectedIndices);
    if (allFilteredSelected) {
      for (const { index } of filteredItemsWithIndices) {
        next.delete(index);
      }
    } else {
      for (const { index } of filteredItemsWithIndices) {
        next.add(index);
      }
    }
    setSelectedIndices(next);
  };

  const toggleItem = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const updateItemStatus = (index: number, newStatus: UserMediaProgressStatusOptions) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], status: newStatus };
      return next;
    });
  };

  const handleStartImport = () => {
    const selectedList = items.filter((_, i) => selectedIndices.has(i));
    if (selectedList.length === 0) {
      toast.error(t.importExport.noItemsSelected);
      return;
    }
    setConfirmOpen(true);
  };

  const handleExecuteImport = () => {
    const selectedList = items.filter((_, i) => selectedIndices.has(i));
    if (selectedList.length === 0) return;

    setConfirmOpen(false);
    startTransition(async () => {
      const res = await batchImportProgress(selectedList);
      if (res.success) {
        const msg = t.importExport.importSuccess
          .replace("{imported}", String(res.data.importedCount))
          .replace("{skipped}", String(res.data.skippedCount));
        toast.success(msg);
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/shelf");
        }
      } else {
        toast.error(res.error || t.importExport.importFailed, {
          description: res.traceId ? `Trace ID: ${res.traceId}` : undefined,
        });
      }
    });
  };

  const getStatusIcon = (status: UserMediaProgressStatusOptions) => {
    switch (status) {
      case "in_progress":
        return <Clock className="size-3 text-amber-500" />;
      case "completed":
        return <CheckCircle2 className="size-3 text-emerald-500" />;
      case "plan_to_consume":
        return <Bookmark className="size-3 text-muted-foreground" />;
      case "on_hold":
        return <PauseCircle className="size-3 text-orange-500" />;
      case "dropped":
        return <XCircle className="size-3 text-rose-500" />;
    }
  };

  const getStatusLabel = (status: UserMediaProgressStatusOptions) => {
    switch (status) {
      case "in_progress":
        return t.shelf.statusInProgress;
      case "completed":
        return t.shelf.statusCompleted;
      case "plan_to_consume":
        return t.shelf.statusPlanToConsume;
      case "on_hold":
        return t.shelf.statusOnHold;
      case "dropped":
        return t.shelf.statusDropped;
    }
  };

  return (
    <div className="space-y-4">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border/80 bg-card/60">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span>{t.importExport.previewTitle}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            {t.importExport.selectedCount
              .replace("{selected}", String(selectedIndices.size))
              .replace("{total}", String(items.length))}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search bar inside preview */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t.common.search}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 h-8 text-xs w-full sm:w-48 bg-background/80"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="h-8 text-xs gap-1.5"
            >
              {allFilteredSelected ? (
                <>
                  <Square className="size-3.5" />
                  <span>{t.importExport.deselectAll}</span>
                </>
              ) : (
                <>
                  <CheckSquare className="size-3.5" />
                  <span>{t.importExport.selectAll}</span>
                </>
              )}
            </Button>

            <Button
              size="sm"
              disabled={selectedIndices.size === 0 || isPending}
              onClick={handleStartImport}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>{t.importExport.importing}</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>
                    {t.importExport.importSelected.replace(
                      "{count}",
                      String(selectedIndices.size),
                    )}
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground border-b border-border/60 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 pl-4 pr-2 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    aria-label={allFilteredSelected ? t.importExport.deselectAll : t.importExport.selectAll}
                    className="p-1 hover:text-foreground text-muted-foreground transition-colors"
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="size-4 text-primary" />
                    ) : (
                      <Square className="size-4" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3">{t.importExport.columnTitle}</th>
                <th className="py-2.5 px-3 w-28">{t.importExport.columnType}</th>
                <th className="py-2.5 px-3 w-36">{t.importExport.columnStatus}</th>
                <th className="py-2.5 px-3 w-24">{t.importExport.columnRating}</th>
                <th className="py-2.5 pr-4 pl-3 w-28 text-right">{t.importExport.columnProgress}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    {t.common.noItemsFound}
                  </td>
                </tr>
              ) : (
                paginatedItems.map(({ item, index }) => {
                  const isSelected = selectedIndices.has(index);
                  return (
                    <tr
                      key={index}
                      onClick={() => toggleItem(index)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/40 select-none",
                        isSelected ? "bg-primary/5 hover:bg-primary/10" : "opacity-60",
                      )}
                    >
                      <td
                        className="py-2.5 pl-4 pr-2 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label={isSelected ? t.common.deselect : t.common.select}
                          onClick={() => toggleItem(index)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="space-y-0.5 max-w-sm sm:max-w-md">
                          <p className="font-medium text-foreground truncate">{item.title}</p>
                          {item.creator && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {item.creator}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <MediaBadge type={item.mediaType} size="sm" />
                      </td>

                      <td
                        className="py-2.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={item.status}
                          onChange={(e) =>
                            updateItemStatus(
                              index,
                              e.target.value as UserMediaProgressStatusOptions,
                            )
                          }
                          className="text-xs bg-background/80 border border-border/80 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
                        >
                          <option value="in_progress">{t.shelf.statusInProgress}</option>
                          <option value="completed">{t.shelf.statusCompleted}</option>
                          <option value="plan_to_consume">{t.shelf.statusPlanToConsume}</option>
                          <option value="on_hold">{t.shelf.statusOnHold}</option>
                          <option value="dropped">{t.shelf.statusDropped}</option>
                        </select>
                      </td>

                      <td className="py-2.5 px-3">
                        {item.rating ? (
                          <div className="flex items-center gap-0.5 text-amber-500 font-semibold text-[11px]">
                            <Star className="size-3 fill-amber-500" />
                            <span>{item.rating}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>

                      <td className="py-2.5 pr-4 pl-3 text-right text-[11px] text-muted-foreground whitespace-nowrap">
                        {item.progressTotal ? (
                          <span>
                            {item.progressCurrent ?? 0} / {item.progressTotal}{" "}
                            {item.progressUnit || ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-border/60 bg-muted/30 flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground text-[11px]">
              {t.common.pageOf
                .replace("{current}", String(safeCurrentPage))
                .replace("{total}", String(totalPages))}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                aria-label={t.common.previous}
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="size-7 p-0"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={t.common.next}
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="size-7 p-0"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Base UI AlertDialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.importExport.confirmImportTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.importExport.confirmImportDesc.replace(
                "{count}",
                String(selectedIndices.size),
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecuteImport} disabled={isPending}>
              {isPending ? t.importExport.importing : t.importExport.confirmButton}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
