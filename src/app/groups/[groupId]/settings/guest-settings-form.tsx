"use client";

import { useState, useTransition } from "react";
import {
  Globe,
  Copy,
  Check,
  Eye,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateGroupGuestSettings } from "@/lib/actions/groups";
import { useTranslations } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { GroupGuestSettings } from "@/types/pocketbase-types";

interface GuestSettingsFormProps {
  groupId: string;
  initialIsPublic?: boolean;
  initialSettings?: GroupGuestSettings | null;
}

export function GuestSettingsForm({
  groupId,
  initialIsPublic = false,
  initialSettings,
}: GuestSettingsFormProps) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [visibility, setVisibility] = useState({
    backlog: initialSettings?.visibility?.backlog ?? true,
    finished: initialSettings?.visibility?.finished ?? true,
    reviews: initialSettings?.visibility?.reviews ?? true,
    comments: initialSettings?.visibility?.comments ?? true,
  });
  const [permissions, setPermissions] = useState({
    canVote: initialSettings?.permissions?.canVote ?? false,
    canComment: initialSettings?.permissions?.canComment ?? false,
    canReview: initialSettings?.permissions?.canReview ?? false,
    canPropose: initialSettings?.permissions?.canPropose ?? false,
  });

  const handleCopyLink = async () => {
    try {
      const publicUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/groups/${groupId}`
          : `/groups/${groupId}`;
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success(t.guestManagement.publicLinkCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.common.error);
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await updateGroupGuestSettings(groupId, {
          isPublic,
          visibility,
          permissions,
        });
        if (res && typeof res === "object" && "success" in res && !res.success) {
          toast.error(res.error || t.guestManagement.settingsSaveFailed, {
            description: res.traceId ? t.common.refCode.replace("{code}", res.traceId) : undefined,
          });
          return;
        }
        toast.success(t.guestManagement.settingsSaved);
      } catch {
        toast.error(t.guestManagement.settingsSaveFailed);
      }
    });
  };

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <div>
              <CardTitle className="text-sm font-semibold">
                {t.guestManagement.publicCircleTitle}
              </CardTitle>
              <CardDescription className="text-xs">
                {t.guestManagement.publicCircleDesc}
              </CardDescription>
            </div>
          </div>
          {isPublic && (
            <Badge
              variant="default"
              className="text-[10px] uppercase tracking-wider font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
            >
              {t.guestManagement.publicBadge}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-1">
        {/* Master Switch: Enable Public Circle */}
        <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-muted/40 border border-border/50">
          <div className="space-y-0.5 min-w-0">
            <label
              htmlFor="is-public-toggle"
              className="text-xs font-semibold text-foreground cursor-pointer block"
            >
              {t.guestManagement.makePublicLabel}
            </label>
            <p className="text-[11px] text-muted-foreground">
              {t.guestManagement.makePublicDesc}
            </p>
          </div>

          <button
            id="is-public-toggle"
            type="button"
            role="switch"
            aria-checked={isPublic}
            onClick={() => setIsPublic(!isPublic)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isPublic ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block size-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out",
                isPublic ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </div>

        {/* Public Access Subsections (Only if isPublic is active) */}
        {isPublic && (
          <div className="space-y-5 animate-in fade-in-50 duration-200">
            {/* Copy Public Link Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-lg bg-card border border-border/60">
              <div className="min-w-0 flex items-center gap-2">
                <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-mono text-muted-foreground truncate">
                  /groups/{groupId}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleCopyLink}
                className="gap-1.5 shrink-0 self-start sm:self-auto"
              >
                {copied ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span>{t.common.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    <span>{t.guestManagement.copyPublicLink}</span>
                  </>
                )}
              </Button>
            </div>

            {/* Visibility Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                <Eye className="size-3.5 text-primary" />
                <span>{t.guestManagement.visibilityHeading}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    key: "backlog" as const,
                    label: t.guestManagement.visibilityBacklog,
                    checked: visibility.backlog,
                  },
                  {
                    key: "finished" as const,
                    label: t.guestManagement.visibilityFinished,
                    checked: visibility.finished,
                  },
                  {
                    key: "reviews" as const,
                    label: t.guestManagement.visibilityReviews,
                    checked: visibility.reviews,
                  },
                  {
                    key: "comments" as const,
                    label: t.guestManagement.visibilityComments,
                    checked: visibility.comments,
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <span className="text-xs font-medium text-foreground">
                      {item.label}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.checked}
                      onClick={() =>
                        setVisibility((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key],
                        }))
                      }
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        item.checked ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-xs ring-0 transition duration-200 ease-in-out",
                          item.checked ? "translate-x-4" : "translate-x-0",
                        )}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>

            {/* Guest Permissions Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>{t.guestManagement.permissionsHeading}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    key: "canVote" as const,
                    label: t.guestManagement.permVote,
                    checked: permissions.canVote,
                  },
                  {
                    key: "canComment" as const,
                    label: t.guestManagement.permComment,
                    checked: permissions.canComment,
                  },
                  {
                    key: "canReview" as const,
                    label: t.guestManagement.permReview,
                    checked: permissions.canReview,
                  },
                  {
                    key: "canPropose" as const,
                    label: t.guestManagement.permPropose,
                    checked: permissions.canPropose,
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <span className="text-xs font-medium text-foreground">
                      {item.label}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.checked}
                      onClick={() =>
                        setPermissions((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key],
                        }))
                      }
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        item.checked ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-xs ring-0 transition duration-200 ease-in-out",
                          item.checked ? "translate-x-4" : "translate-x-0",
                        )}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Save Changes Button */}
        <div className="flex justify-end pt-2 border-t border-border/50">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            size="sm"
            className="gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>{t.common.saving}</span>
              </>
            ) : (
              <span>{t.guestManagement.saveChanges}</span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
