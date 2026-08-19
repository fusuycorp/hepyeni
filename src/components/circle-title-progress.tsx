"use client";

import { useState } from "react";
import { Users, Clock, CheckCircle2, Bookmark, Star, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditProgressDialog } from "@/app/shelf/edit-progress-dialog";
import { AddToShelfDialog } from "@/app/shelf/add-to-shelf-dialog";
import { getDisplayName, getInitials } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { TitleMemberProgressItem } from "@/lib/actions/progress";
import type { TitlesMediaTypeOptions, TitlesResponse, UserMediaProgressResponse } from "@/types/pocketbase-types";

interface CircleTitleProgressProps {
  title: TitlesResponse;
  memberProgress: TitleMemberProgressItem[];
  currentUserId?: string;
  isMember?: boolean;
}

export function CircleTitleProgress({
  title,
  memberProgress,
  currentUserId,
  isMember = true,
}: CircleTitleProgressProps) {
  const t = useTranslations();
  const [editingItem, setEditingItem] = useState<UserMediaProgressResponse | null>(null);

  const currentUserProgress = currentUserId
    ? memberProgress.find((p) => p.user.id === currentUserId)?.progress
    : null;

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              {t.shelf.circleProgressTitle}
            </CardTitle>
          </div>

          {isMember && currentUserId && (
            currentUserProgress ? (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setEditingItem(currentUserProgress)}
                className="gap-1.5 text-xs"
              >
                <span>{t.shelf.updateMyProgress}</span>
              </Button>
            ) : null
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {memberProgress.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            {t.shelf.circleProgressSubtitle}
          </p>
        ) : (
          <div className="divide-y divide-border/50">
            {memberProgress.map(({ user, progress, percentage }) => {
              const displayName = getDisplayName(user, t.common.unnamedUser);
              const initials = getInitials(user.name, user.email);
              const isCurrentUser = user.id === currentUserId;

              const unitLabel = progress.progressUnit
                ? t.shelf[progress.progressUnit] || progress.progressUnit
                : t.shelf.pages;

              return (
                <div
                  key={progress.id}
                  className={cn(
                    "py-3 first:pt-0 last:pb-0 space-y-2",
                    isCurrentUser && "bg-primary/5 -mx-4 px-4 rounded-lg my-1",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar size="sm" className="ring-1 ring-border">
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {displayName} {isCurrentUser && <span className="text-[10px] text-primary">({t.admin.currentUserTag})</span>}
                        </p>
                        {progress.currentLabel && (
                          <p className="text-[11px] font-mono text-muted-foreground truncate">
                            {progress.currentLabel}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {progress.status === "completed" ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] gap-1 py-0.5 px-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 font-medium"
                        >
                          <CheckCircle2 className="size-2.5" />
                          <span>{t.shelf.statusCompleted}</span>
                          {progress.rating && (
                            <span className="flex items-center text-amber-500 ml-0.5">
                              ★{progress.rating}
                            </span>
                          )}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] gap-1 py-0.5 px-2 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 font-medium"
                        >
                          <Clock className="size-2.5" />
                          <span>
                            {progress.progressCurrent !== undefined
                              ? `${progress.progressCurrent} ${progress.progressTotal ? `/ ${progress.progressTotal}` : ""} ${unitLabel}`
                              : t.shelf.statusInProgress}
                          </span>
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {progress.status !== "plan_to_consume" && (
                    <div className="space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${percentage ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Member Note */}
                  {progress.notes && (
                    <p className="text-[11px] text-muted-foreground italic line-clamp-2 pl-8">
                      &ldquo;{progress.notes}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {editingItem && (
        <EditProgressDialog
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null);
          }}
        />
      )}
    </Card>
  );
}
