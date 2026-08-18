export const MOODS = [
  "cozy",
  "dark",
  "melancholic",
  "mind_bending",
  "uplifting",
  "nostalgic",
  "whimsical",
  "tense",
  "philosophical",
] as const;

export type MoodType = (typeof MOODS)[number];

export const PACES = ["slow_burn", "gentle", "fast_paced"] as const;

export type PaceType = (typeof PACES)[number];

export const MOOD_DETAILS: Record<
  MoodType,
  { emoji: string; color: string; bgColor: string; borderColor: string }
> = {
  cozy: {
    emoji: "☕",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-500/10 hover:bg-amber-500/20",
    borderColor: "border-amber-500/30",
  },
  dark: {
    emoji: "🌑",
    color: "text-zinc-700 dark:text-zinc-300",
    bgColor: "bg-zinc-500/10 hover:bg-zinc-500/20",
    borderColor: "border-zinc-500/30",
  },
  melancholic: {
    emoji: "🌧️",
    color: "text-sky-700 dark:text-sky-300",
    bgColor: "bg-sky-500/10 hover:bg-sky-500/20",
    borderColor: "border-sky-500/30",
  },
  mind_bending: {
    emoji: "🌀",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
    borderColor: "border-purple-500/30",
  },
  uplifting: {
    emoji: "☀️",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20",
    borderColor: "border-emerald-500/30",
  },
  nostalgic: {
    emoji: "📻",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
    borderColor: "border-orange-500/30",
  },
  whimsical: {
    emoji: "✨",
    color: "text-pink-700 dark:text-pink-300",
    bgColor: "bg-pink-500/10 hover:bg-pink-500/20",
    borderColor: "border-pink-500/30",
  },
  tense: {
    emoji: "⚡",
    color: "text-rose-700 dark:text-rose-300",
    bgColor: "bg-rose-500/10 hover:bg-rose-500/20",
    borderColor: "border-rose-500/30",
  },
  philosophical: {
    emoji: "🏛️",
    color: "text-teal-700 dark:text-teal-300",
    bgColor: "bg-teal-500/10 hover:bg-teal-500/20",
    borderColor: "border-teal-500/30",
  },
};

export const PACE_DETAILS: Record<
  PaceType,
  { emoji: string; color: string; bgColor: string; borderColor: string }
> = {
  slow_burn: {
    emoji: "🕯️",
    color: "text-indigo-700 dark:text-indigo-300",
    bgColor: "bg-indigo-500/10 hover:bg-indigo-500/20",
    borderColor: "border-indigo-500/30",
  },
  gentle: {
    emoji: "🍃",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-500/10 hover:bg-green-500/20",
    borderColor: "border-green-500/30",
  },
  fast_paced: {
    emoji: "🚀",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-500/10 hover:bg-amber-500/20",
    borderColor: "border-amber-500/30",
  },
};

export function isMood(val: unknown): val is MoodType {
  return typeof val === "string" && (MOODS as readonly string[]).includes(val);
}

export function isPace(val: unknown): val is PaceType {
  return typeof val === "string" && (PACES as readonly string[]).includes(val);
}

export function normalizeMoods(raw: unknown): MoodType[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const valid = list.filter(isMood);
  return Array.from(new Set(valid));
}

export function normalizePace(raw: unknown): PaceType | undefined {
  if (isPace(raw)) return raw;
  return undefined;
}

export function filterTitlesByMood<
  T extends {
    moods?: MoodType[] | null;
    metadata?: Record<string, unknown> | null;
  },
>(items: T[], mood?: string | null): T[] {
  if (!mood || mood === "all" || !mood.trim()) {
    return items;
  }
  const cleanMood = mood.trim();
  return items.filter((item) => {
    if (Array.isArray(item.moods) && item.moods.includes(cleanMood as MoodType)) {
      return true;
    }
    const metaMoods = item.metadata?.moods;
    if (Array.isArray(metaMoods) && metaMoods.includes(cleanMood)) {
      return true;
    }
    return false;
  });
}

export function shouldRedactProposalIdentity({
  isBlindPickEnabled,
  isOwnerOrAdmin,
}: {
  isBlindPickEnabled?: boolean;
  isOwnerOrAdmin?: boolean;
}): boolean {
  return Boolean(isBlindPickEnabled && !isOwnerOrAdmin);
}

export function redactProposedTitles<
  T extends {
    status: string;
    addedBy?: string;
    expand?: {
      addedBy?: unknown;
      [key: string]: unknown;
    };
  },
>(
  titles: T[],
  isBlindPickEnabled?: boolean,
  isOwnerOrAdmin?: boolean,
): T[] {
  if (!shouldRedactProposalIdentity({ isBlindPickEnabled, isOwnerOrAdmin })) {
    return titles;
  }

  return titles.map((item) => {
    if (item.status === "proposed") {
      const copy = { ...item, addedBy: "" };
      if (copy.expand) {
        copy.expand = { ...copy.expand, addedBy: undefined };
      }
      return copy;
    }
    return item;
  });
}

export function sampleWheelCandidates<T extends { score?: number }>(
  items: T[],
  maxCandidates = 8,
): T[] {
  if (!items || items.length === 0) return [];
  // Sort items by score descending
  const sorted = [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return sorted.slice(0, maxCandidates);
}

export function pickWheelWinner<T>(
  items: T[],
  rng: () => number = Math.random,
): { winner: T; index: number } | null {
  if (!items || items.length === 0) return null;
  const rawRng = rng();
  const clampedRng = Math.max(0, Math.min(0.99999999, rawRng));
  const index = Math.floor(clampedRng * items.length);
  return {
    winner: items[index],
    index,
  };
}

export function calculateWheelRotation({
  winnerIndex,
  totalSlices,
  minSpins = 5,
  extraOffset = 0,
}: {
  winnerIndex: number;
  totalSlices: number;
  minSpins?: number;
  extraOffset?: number;
}): number {
  if (totalSlices <= 0) return 0;
  const sliceDeg = 360 / totalSlices;
  // Center of the winning slice
  // When rotation is R degrees clockwise:
  // Top pointer (at 0°/270°) aligns with:
  // (360 - (winnerIndex * sliceDeg + sliceDeg / 2))
  const sliceCenter = winnerIndex * sliceDeg + sliceDeg / 2;
  const targetDegree = (360 - sliceCenter) % 360;
  const baseRotation = minSpins * 360 + targetDegree + extraOffset;
  return baseRotation;
}
