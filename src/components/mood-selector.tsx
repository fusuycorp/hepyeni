"use client";

import React from "react";
import {
  MOODS,
  PACES,
  MOOD_DETAILS,
  PACE_DETAILS,
  type MoodType,
  type PaceType,
} from "@/lib/moods";
import { useTranslations } from "@/lib/i18n/client";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface MoodSelectorProps {
  selectedMoods: MoodType[];
  onChangeMoods: (moods: MoodType[]) => void;
  selectedPace?: PaceType;
  onChangePace?: (pace?: PaceType) => void;
  readOnly?: boolean;
  showPace?: boolean;
  className?: string;
}

export function MoodSelector({
  selectedMoods = [],
  onChangeMoods,
  selectedPace,
  onChangePace,
  readOnly = false,
  showPace = true,
  className,
}: MoodSelectorProps) {
  const t = useTranslations();

  const handleToggleMood = (mood: MoodType) => {
    if (readOnly) return;
    if (selectedMoods.includes(mood)) {
      onChangeMoods(selectedMoods.filter((m) => m !== mood));
    } else {
      onChangeMoods([...selectedMoods, mood]);
    }
  };

  const handleTogglePace = (pace: PaceType) => {
    if (readOnly || !onChangePace) return;
    if (selectedPace === pace) {
      onChangePace(undefined);
    } else {
      onChangePace(pace);
    }
  };

  return (
    <div className={cn("space-y-3.5", className)}>
      {/* Moods Section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground">
            {t.moods.moodsLabel}
          </Label>
          {selectedMoods.length > 0 && !readOnly && (
            <span className="text-[10px] text-muted-foreground">
              {selectedMoods.length} seçildi
            </span>
          )}
        </div>
        <div
          role="group"
          aria-label={t.moods.moodsLabel}
          className="flex flex-wrap gap-1.5"
        >
          {MOODS.map((mood) => {
            const isSelected = selectedMoods.includes(mood);
            const detail = MOOD_DETAILS[mood];
            const moodName = t.moods[mood];

            return (
              <button
                key={mood}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                disabled={readOnly}
                onClick={() => handleToggleMood(mood)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer select-none",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs scale-105"
                    : cn(
                        "bg-background text-muted-foreground border-border hover:text-foreground",
                        detail?.bgColor,
                      ),
                  readOnly && "cursor-default opacity-80",
                )}
              >
                <span>{detail?.emoji}</span>
                <span>{moodName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pacing Section */}
      {showPace && onChangePace && (
        <div className="space-y-1.5 pt-1">
          <Label className="text-xs font-semibold text-foreground">
            {t.moods.paceLabel}
          </Label>
          <div
            role="radiogroup"
            aria-label={t.moods.paceLabel}
            className="flex flex-wrap gap-1.5"
          >
            {PACES.map((pace) => {
              const isSelected = selectedPace === pace;
              const detail = PACE_DETAILS[pace];
              const paceName = t.moods[pace];

              return (
                <button
                  key={pace}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={readOnly}
                  onClick={() => handleTogglePace(pace)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer select-none",
                    isSelected
                      ? "bg-foreground text-background border-foreground font-semibold shadow-2xs scale-105"
                      : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
                    readOnly && "cursor-default opacity-80",
                  )}
                >
                  <span>{detail?.emoji}</span>
                  <span>{paceName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
