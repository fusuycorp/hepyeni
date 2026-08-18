"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Trophy, RotateCcw, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { useTranslations } from "@/lib/i18n/client";
import {
  sampleWheelCandidates,
  pickWheelWinner,
  calculateWheelRotation,
} from "@/lib/moods";
import { cn } from "@/lib/utils";
import type { TitlesResponse } from "@/types/pocketbase-types";

// Distinct harmonious segment colors for wheel
const WHEEL_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
];

interface TitleItem extends Partial<TitlesResponse> {
  id: string;
  title: string;
  creator?: string;
  coverUrl?: string;
  mediaType?: any;
  score?: number;
}

export interface DecisionWheelDialogProps {
  items: TitleItem[];
  groupId: string;
  groupName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function DecisionWheelDialog({
  items,
  groupId,
  groupName,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: DecisionWheelDialogProps) {
  const t = useTranslations();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const candidates = useMemo(() => sampleWheelCandidates(items, 8), [items]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationDegree, setRotationDegree] = useState(0);
  const [winner, setWinner] = useState<TitleItem | null>(null);
  const [winnerRevealed, setWinnerRevealed] = useState(false);

  const accumulatedRotationRef = useRef(0);

  // Reset winner state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setIsSpinning(false);
      setWinner(null);
      setWinnerRevealed(false);
      setRotationDegree(0);
      accumulatedRotationRef.current = 0;
    }
  }, [open]);

  const handleSpin = () => {
    if (isSpinning || candidates.length === 0) return;

    setWinnerRevealed(false);
    setWinner(null);
    setIsSpinning(true);

    const result = pickWheelWinner(candidates);
    if (!result) {
      setIsSpinning(false);
      return;
    }

    const { winner: chosenWinner, index } = result;

    const spins = 5 + Math.floor(Math.random() * 3); // 5 to 7 full spins
    const targetBaseRotation = calculateWheelRotation({
      winnerIndex: index,
      totalSlices: candidates.length,
      minSpins: spins,
    });

    // Ensure forward monotonic spin
    const currentRot = accumulatedRotationRef.current;
    const nextRot = currentRot + targetBaseRotation + (360 - (currentRot % 360));
    accumulatedRotationRef.current = nextRot;
    setRotationDegree(nextRot);

    // Timeout matching CSS spin animation duration (4000ms)
    setTimeout(() => {
      setIsSpinning(false);
      setWinner(chosenWinner);
      setWinnerRevealed(true);
    }, 4100);
  };

  const sliceAngle = candidates.length > 0 ? 360 / candidates.length : 360;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={<>{trigger}</>} />
      ) : (
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold shadow-2xs cursor-pointer"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>{t.wheel.spinWheel}</span>
            </Button>
          }
        />
      )}

      <DialogContent className="max-w-md sm:max-w-lg overflow-hidden flex flex-col items-center p-6 text-center">
        <DialogHeader className="w-full space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center justify-center gap-2 text-foreground">
            <Sparkles className="size-5 text-primary animate-pulse" />
            <span>{t.wheel.spinWheel}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {candidates.length > 0
              ? t.wheel.candidatesCount.replace("{count}", String(candidates.length))
              : t.wheel.needBacklogItems}
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <div className="py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{t.wheel.needBacklogItems}</p>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {t.common.close}
            </Button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center space-y-6 pt-2">
            {/* Wheel Container with Top Pointer */}
            <div className="relative size-64 sm:size-72 flex items-center justify-center">
              {/* Pointer Indicator at Top Center */}
              <div className="absolute -top-3 z-30 flex flex-col items-center">
                <div className="size-0 border-x-10 border-x-transparent border-t-16 border-t-primary drop-shadow-md" />
              </div>

              {/* Wheel SVG */}
              <div
                className="size-full rounded-full border-4 border-foreground/10 shadow-xl overflow-hidden transition-transform ease-out"
                style={{
                  transform: `rotate(${rotationDegree}deg)`,
                  transitionDuration: isSpinning ? "4000ms" : "0ms",
                  transitionTimingFunction: "cubic-bezier(0.12, 0.8, 0.15, 1)",
                }}
              >
                <svg
                  viewBox="0 0 200 200"
                  className="size-full"
                  style={{ transform: "rotate(-90deg)" }} // Start slice 0 at top pointer
                >
                  {candidates.map((item, idx) => {
                    const startAngle = (idx * sliceAngle * Math.PI) / 180;
                    const endAngle = (((idx + 1) * sliceAngle) * Math.PI) / 180;
                    const x1 = 100 + 100 * Math.cos(startAngle);
                    const y1 = 100 + 100 * Math.sin(startAngle);
                    const x2 = 100 + 100 * Math.cos(endAngle);
                    const y2 = 100 + 100 * Math.sin(endAngle);
                    const largeArcFlag = sliceAngle > 180 ? 1 : 0;
                    const pathData = `M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

                    // Text rotation & positioning
                    const midAngle = idx * sliceAngle + sliceAngle / 2;
                    const color = WHEEL_COLORS[idx % WHEEL_COLORS.length];

                    return (
                      <g key={item.id}>
                        <path
                          d={pathData}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          opacity="0.9"
                        />
                        <text
                          x="155"
                          y="104"
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="end"
                          transform={`rotate(${midAngle}, 100, 100)`}
                          style={{
                            userSelect: "none",
                            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                          }}
                        >
                          {item.title.length > 14
                            ? item.title.slice(0, 13) + "…"
                            : item.title}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Center Hub */}
              <div className="absolute z-20 size-12 rounded-full bg-background border-4 border-primary shadow-md flex items-center justify-center">
                <Sparkles className="size-5 text-primary" />
              </div>
            </div>

            {/* Winner Announcement Reveal Card */}
            {winnerRevealed && winner && (
              <div className="w-full p-4 rounded-xl bg-primary/10 border border-primary/30 flex flex-col sm:flex-row items-center gap-4 animate-in fade-in-50 zoom-in-95 duration-200">
                <div className="relative shrink-0">
                  <MediaCover
                    src={winner.coverUrl}
                    alt={winner.title}
                    size="md"
                    className="rounded-lg shadow-md"
                  />
                  <div className="absolute -top-2 -right-2 size-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Trophy className="size-3.5" />
                  </div>
                </div>

                <div className="flex-1 text-left min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    {winner.mediaType && (
                      <MediaBadge type={winner.mediaType} size="sm" />
                    )}
                    <span className="text-[10px] font-bold tracking-wider uppercase text-primary">
                      {t.wheel.winnerTitle}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-foreground truncate">
                    {winner.title}
                  </h4>
                  {winner.creator && (
                    <p className="text-xs text-muted-foreground truncate">
                      {winner.creator}
                    </p>
                  )}
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/groups/${groupId}/titles/${winner.id}`}
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
                    >
                      <span>{t.wheel.viewWinner}</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSpin}
                      className="gap-1.5 text-xs h-7.5"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>{t.wheel.respin}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Spin Trigger Button */}
            {!winnerRevealed && (
              <Button
                type="button"
                size="lg"
                disabled={isSpinning || candidates.length === 0}
                onClick={handleSpin}
                className="px-8 py-3 rounded-full text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all gap-2 cursor-pointer"
              >
                <Sparkles className={cn("size-4", isSpinning && "animate-spin")} />
                <span>{isSpinning ? t.wheel.spinning : t.wheel.spinToDecide}</span>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
