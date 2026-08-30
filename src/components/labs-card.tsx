"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FEATURE_FLAGS, FEATURE_FLAG_KEYS, type FeatureFlagKey } from "@/lib/flags/registry";
import { toggleUserFeatureFlag } from "@/lib/flags/actions";
import { useFeatureFlags } from "@/lib/flags/client";
import { useTranslations } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function LabsCard() {
  const t = useTranslations();
  const flags = useFeatureFlags();
  const [localFlags, setLocalFlags] = useState<Record<FeatureFlagKey, boolean>>(flags);
  const [pendingFlag, setPendingFlag] = useState<FeatureFlagKey | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (key: FeatureFlagKey, checked: boolean) => {
    setPendingFlag(key);
    const previous = localFlags[key];
    setLocalFlags((prev) => ({ ...prev, [key]: checked }));

    startTransition(async () => {
      const res = await toggleUserFeatureFlag(key, checked);
      setPendingFlag(null);
      if (!res.success) {
        setLocalFlags((prev) => ({ ...prev, [key]: previous }));
        toast.error(res.error || t.labs.toggleFailed, {
          description: res.traceId ? t.common.refCode.replace("{code}", res.traceId) : undefined,
        });
      } else {
        toast.success(t.labs.toggleSuccess);
      }
    });
  };

  const flagMetadata = {
    spoiler_blur: {
      name: t.labs.flags.spoiler_blur.name,
      desc: t.labs.flags.spoiler_blur.desc,
      stage: FEATURE_FLAGS.spoiler_blur.stage,
    },
    milestone_campfires: {
      name: t.labs.flags.milestone_campfires.name,
      desc: t.labs.flags.milestone_campfires.desc,
      stage: FEATURE_FLAGS.milestone_campfires.stage,
    },
    data_portability: {
      name: t.labs.flags.data_portability.name,
      desc: t.labs.flags.data_portability.desc,
      stage: FEATURE_FLAGS.data_portability.stage,
    },
    digital_marginalia: {
      name: t.labs.flags.digital_marginalia.name,
      desc: t.labs.flags.digital_marginalia.desc,
      stage: FEATURE_FLAGS.digital_marginalia.stage,
    },
    mood_pace_folksonomy: {
      name: t.labs.flags.mood_pace_folksonomy.name,
      desc: t.labs.flags.mood_pace_folksonomy.desc,
      stage: FEATURE_FLAGS.mood_pace_folksonomy.stage,
    },
    blind_pick_wheel: {
      name: t.labs.flags.blind_pick_wheel.name,
      desc: t.labs.flags.blind_pick_wheel.desc,
      stage: FEATURE_FLAGS.blind_pick_wheel.stage,
    },
    llm_extract: {
      name: t.labs.flags.llm_extract.name,
      desc: t.labs.flags.llm_extract.desc,
      stage: FEATURE_FLAGS.llm_extract.stage,
    },
  };

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">{t.labs.title}</CardTitle>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal border-primary/30 text-primary">
                  {t.labs.badge}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {t.labs.subtitle}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t.labs.description}
        </p>

        <div className="space-y-3 divide-y divide-border/40">
          {FEATURE_FLAG_KEYS.map((key) => {
            const meta = flagMetadata[key];
            const isEnabled = localFlags[key] ?? FEATURE_FLAGS[key].defaultEnabled;
            const isItemPending = pendingFlag === key;

            return (
              <div
                key={key}
                className={cn(
                  "flex items-start justify-between gap-3 pt-3 first:pt-0 transition-opacity",
                  isItemPending && "opacity-70",
                )}
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {meta.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[9px] py-0 px-1.5 font-mono uppercase",
                        meta.stage === "beta" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                        meta.stage === "alpha" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                      )}
                    >
                      {meta.stage}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {meta.desc}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  {isItemPending && (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  )}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(key, checked)}
                    disabled={isItemPending}
                    aria-label={meta.name}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
