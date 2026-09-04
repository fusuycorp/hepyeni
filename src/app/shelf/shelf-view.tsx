"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Bookmark,
  Star,
  Settings2,
  Users,
  EyeOff,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { AddToShelfDialog } from "./add-to-shelf-dialog";
import { EditProgressDialog } from "./edit-progress-dialog";
import { QuotesTab } from "./quotes-tab";
import { updateProgressQuickStep } from "@/lib/actions/progress";
import { useFeatureFlag } from "@/lib/flags/client";
import { useTranslations } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type {
  ShelfQuotesResponse,
  UserMediaProgressResponse,
} from "@/types/pocketbase-types";
import type { QuoteExpand } from "@/lib/marginalia";

interface ShelfViewProps {
  initialItems: UserMediaProgressResponse[];
  initialQuotes?: ShelfQuotesResponse<QuoteExpand>[];
  currentUserId?: string;
  isAdmin?: boolean;
}

export function ShelfView({
  initialItems,
  initialQuotes = [],
  currentUserId,
  isAdmin,
}: ShelfViewProps) {
  const t = useTranslations();
  const isMarginaliaEnabled = useFeatureFlag("digital_marginalia");
  const [activeTab, setActiveTab] = useState<
    "in_progress" | "completed" | "plan_to_consume" | "all" | "quotes"
  >("in_progress");
  const [editingItem, setEditingItem] = useState<UserMediaProgressResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredItems = initialItems.filter((item) => {
    if (activeTab === "all") return true;
    return item.status === activeTab;
  });

  const handleQuickStep = (item: UserMediaProgressResponse, delta: number) => {
    startTransition(async () => {
      const res = await updateProgressQuickStep(item.id, delta);
      if (!res.success) {
        toast.error(res.error, {
          description: res.traceId
            ? t.common.refCode.replace("{code}", res.traceId)
            : undefined,
        });
      }
    });
  };

  const getStatusBadge = (item: UserMediaProgressResponse) => {
    switch (item.status) {
      case "in_progress":
        return (
          <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5 font-mono font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 rounded-xs">
            <Clock className="size-2.5" />
            <span>{t.shelf.statusInProgress}</span>
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5 font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 rounded-xs">
            <CheckCircle2 className="size-2.5" />
            <span>{t.shelf.statusCompleted}</span>
          </Badge>
        );
      case "plan_to_consume":
        return (
          <Badge variant="outline" className="text-[10px] gap-1 py-0 px-1.5 font-mono font-normal text-muted-foreground border-border/60 rounded-xs">
            <Bookmark className="size-2.5" />
            <span>{t.shelf.statusPlanToConsume}</span>
          </Badge>
        );
      default:
        return null;
    }
  };

  const tabs = [
    { id: "in_progress" as const, label: t.shelf.tabInProgress },
    { id: "completed" as const, label: t.shelf.tabCompleted },
    { id: "plan_to_consume" as const, label: t.shelf.tabPlanToConsume },
    { id: "all" as const, label: t.shelf.tabAll },
    ...(isMarginaliaEnabled
      ? [{ id: "quotes" as const, label: t.marginalia.tabTitle }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary shrink-0" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t.shelf.pageTitle}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.shelf.pageSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <Link href="/shelf/import-export">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 h-8 rounded-sm"
            >
              <ArrowUpDown className="size-3.5" />
              <span>{t.shelf.importExport}</span>
            </Button>
          </Link>
          <AddToShelfDialog />
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full overflow-x-auto scrollbar-none overscroll-x-contain touch-pan-x pb-1">
        <div
          role="tablist"
          className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-sm border border-border/60 min-w-full sm:min-w-fit"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 sm:flex-initial px-3 py-1.5 rounded-xs text-xs font-medium transition-all whitespace-nowrap shrink-0 text-center min-h-[32px] sm:min-h-0",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content depending on active tab */}
      {activeTab === "quotes" && isMarginaliaEnabled ? (
        <QuotesTab
          initialQuotes={initialQuotes}
          shelfItems={initialItems}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-sm border border-dashed border-border/60 bg-card/40 space-y-3">
          <div className="flex size-10 items-center justify-center rounded-sm bg-muted/60 text-muted-foreground mx-auto">
            <Sparkles className="size-5" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <p className="text-xs font-medium text-foreground">
              {activeTab === "in_progress"
                ? t.shelf.emptyInProgress
                : activeTab === "completed"
                ? t.shelf.emptyCompleted
                : activeTab === "plan_to_consume"
                ? t.shelf.emptyPlanToConsume
                : t.common.noItemsFound}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredItems.map((item) => {
            const hasProgress =
              typeof item.progressCurrent === "number" &&
              typeof item.progressTotal === "number" &&
              item.progressTotal > 0;
            const percentage = hasProgress
              ? Math.min(
                  100,
                  Math.round(((item.progressCurrent || 0) / (item.progressTotal || 1)) * 100),
                )
              : item.status === "completed"
              ? 100
              : 0;

            const unitLabel = item.progressUnit
              ? t.shelf[item.progressUnit] || item.progressUnit
              : t.shelf.pages;

            return (
              <Card
                key={item.id}
                className="overflow-hidden border-border/60 hover:border-border transition-colors bg-card flex flex-col justify-between"
              >
                <CardContent className="p-4 space-y-3.5">
                  {/* Top Row: Cover, Info, Status */}
                  <div className="flex items-start gap-3.5">
                    <MediaCover
                      src={item.coverUrl}
                      alt={item.title}
                      size="md"
                      className="shrink-0 rounded-sm"
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <MediaBadge type={item.mediaType} size="sm" />
                        <div className="flex items-center gap-1.5">
                          {item.isSharedWithCircles ? (
                            <span
                              title={t.shelf.shareWithCircles}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Users className="size-3" />
                            </span>
                          ) : (
                            <span
                              title={t.shelf.privateToShelfTooltip}
                              className="text-muted-foreground/40"
                            >
                              <EyeOff className="size-3" />
                            </span>
                          )}
                          {getStatusBadge(item)}
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
                        {item.title}
                      </h3>
                      {item.creator && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.creator}
                        </p>
                      )}

                      {/* Completed Rating or Checkpoint Label */}
                      {item.status === "completed" && item.rating ? (
                        <div className="flex items-center gap-0.5 pt-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={cn(
                                "size-3",
                                item.rating && item.rating >= star
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/30",
                              )}
                            />
                          ))}
                        </div>
                      ) : item.currentLabel ? (
                        <p className="text-[11px] font-mono text-primary truncate pt-0.5">
                          {item.currentLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Progress Meter Bar */}
                  {item.status !== "plan_to_consume" && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {item.progressCurrent !== undefined
                            ? `${item.progressCurrent} ${item.progressTotal ? `/ ${item.progressTotal}` : ""} ${unitLabel}`
                            : `${percentage}%`}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {percentage}%
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Personal Notes Snippet */}
                  {item.notes && (
                    <div className="p-2 rounded-lg bg-muted/30 border border-border/40 text-[11px] text-muted-foreground line-clamp-2 italic">
                      &ldquo;{item.notes}&rdquo;
                    </div>
                  )}

                  {/* Bottom Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                    {/* Quick Step Buttons for Active items */}
                    {item.status === "in_progress" ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={isPending || !item.progressCurrent}
                          onClick={() => handleQuickStep(item, -1)}
                          className="size-8 sm:size-7 p-0 shrink-0"
                          title="-1"
                        >
                          <Minus className="size-3.5 sm:size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={isPending}
                          onClick={() => handleQuickStep(item, 1)}
                          className="h-8 sm:h-7 px-2.5 sm:px-2 text-xs font-mono gap-1 shrink-0"
                          title="+1"
                        >
                          <Plus className="size-3.5 sm:size-3" />
                          <span>1 {unitLabel}</span>
                        </Button>
                      </div>
                    ) : (
                      <div />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setEditingItem(item)}
                      className="gap-1 text-xs text-muted-foreground hover:text-foreground ml-auto shrink-0 h-8 sm:h-7 px-2"
                    >
                      <Settings2 className="size-3.5" />
                      <span>{t.shelf.editProgress}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      {editingItem && (
        <EditProgressDialog
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}
