import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { voteRecordId } from "@/lib/pocketbase/vote-id";
import type PocketBase from "pocketbase";

export const LLM_USAGE_COLLECTION = "llm_usage";
export const LLM_USAGE_WINDOW_MS = 60 * 60 * 1000;
export const LLM_MAX_REQUESTS_PER_WINDOW = 5;
export const LLM_MAX_INPUT_CHARS_PER_WINDOW = 120_000;
export const LLM_INPUT_COST_UNIT_CHARS = 10_000;

export interface LlmUsageLimits {
  windowMs: number;
  maxRequests: number;
  maxInputChars: number;
  costUnitChars: number;
}

export type LlmUsageResult =
  | { allowed: true }
  | { allowed: false; reason: "requests" | "input" };

function positiveEnvInt(names: string | string[], fallback: number): number {
  const nameList = Array.isArray(names) ? names : [names];
  for (const name of nameList) {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

export function getLlmUsageLimits(): LlmUsageLimits {
  return {
    windowMs: positiveEnvInt("LLM_RATE_WINDOW_MS", LLM_USAGE_WINDOW_MS),
    maxRequests: positiveEnvInt(
      ["LLM_HOURLY_REQUEST_LIMIT", "LLM_MAX_REQUESTS_PER_WINDOW"],
      LLM_MAX_REQUESTS_PER_WINDOW,
    ),
    maxInputChars: positiveEnvInt(
      ["LLM_HOURLY_COST_LIMIT", "LLM_MAX_INPUT_CHARS_PER_WINDOW"],
      LLM_MAX_INPUT_CHARS_PER_WINDOW,
    ),
    costUnitChars: positiveEnvInt("LLM_INPUT_COST_UNIT_CHARS", LLM_INPUT_COST_UNIT_CHARS),
  };
}

function isUniqueReservationConflict(err: unknown): boolean {
  if (isValidationNotUnique(err)) return true;
  const candidate = err as {
    status?: unknown;
    response?: { data?: Record<string, { code?: unknown }> };
  };
  return (
    candidate?.status === 400 &&
    Object.values(candidate.response?.data ?? {}).some(
      (field) => field?.code === "validation_not_unique",
    )
  );
}

async function reservationId(userId: string, window: string, kind: string, slot: number) {
  return voteRecordId(`${userId}:${window}:${kind}:${slot}`, "llm");
}

async function deleteReservations(pb: PocketBase, ids: string[]): Promise<void> {
  await Promise.all(
    ids.map(async (id) => {
      try {
        await pb.collection(LLM_USAGE_COLLECTION).delete(id);
      } catch {
        // Cleanup is best effort. Leaving a slot occupied fails closed.
      }
    }),
  );
}

/**
 * Lazy pruning of expired reservation records (ADR-014).
 * Deletes records where window < currentWindow - 1.
 */
export async function pruneExpiredLlmUsage(
  pb: PocketBase,
  currentWindow: number,
): Promise<void> {
  try {
    const col = pb.collection(LLM_USAGE_COLLECTION);
    if (typeof col.getFullList !== "function") return;

    const expiredThreshold = currentWindow - 1;
    const expired = await col.getFullList<{ id: string; window: string }>({
      filter: `window < "${expiredThreshold}"`,
    });
    const toDelete = expired.filter((record) => {
      const w = Number.parseInt(record.window, 10);
      return Number.isFinite(w) ? w < expiredThreshold : true;
    });
    await Promise.all(
      toDelete.map((record) => col.delete(record.id).catch(() => {})),
    );
  } catch {
    // Pruning is lazy and best-effort.
  }
}

/**
 * Reserve unique PocketBase records rather than incrementing a shared counter.
 * PocketBase is the single serialization point shared by all Next replicas.
 */
export async function reserveLlmUsage(
  pb: PocketBase,
  userId: string,
  inputChars: number,
  now = Date.now(),
  limits = getLlmUsageLimits(),
): Promise<LlmUsageResult> {
  const costUnits = Math.max(1, Math.ceil(inputChars / limits.costUnitChars));
  const maxCostUnits = Math.ceil(limits.maxInputChars / limits.costUnitChars);
  if (costUnits > maxCostUnits) return { allowed: false, reason: "input" };

  const currentWindow = Math.floor(now / limits.windowMs);
  const window = String(currentWindow);

  await pruneExpiredLlmUsage(pb, currentWindow);
  const requestIds: string[] = [];
  let requestId: string | undefined;

  for (let slot = 0; slot < limits.maxRequests; slot++) {
    const id = await reservationId(userId, window, "request", slot);
    try {
      await pb.collection(LLM_USAGE_COLLECTION).create({
        id,
        user: userId,
        window,
        kind: "request",
        requestId: id,
      });
      requestId = id;
      requestIds.push(id);
      break;
    } catch (err) {
      if (!isUniqueReservationConflict(err)) throw err;
    }
  }

  if (!requestId) return { allowed: false, reason: "requests" };

  const inputIds: string[] = [];
  for (let slot = 0; slot < maxCostUnits && inputIds.length < costUnits; slot++) {
    const id = await reservationId(userId, window, "input", slot);
    try {
      await pb.collection(LLM_USAGE_COLLECTION).create({
        id,
        user: userId,
        window,
        kind: "input",
        requestId,
      });
      inputIds.push(id);
    } catch (err) {
      if (!isUniqueReservationConflict(err)) {
        await deleteReservations(pb, [...requestIds, ...inputIds]);
        throw err;
      }
    }
  }

  if (inputIds.length < costUnits) {
    await deleteReservations(pb, [...requestIds, ...inputIds]);
    return { allowed: false, reason: "input" };
  }

  return { allowed: true };
}
