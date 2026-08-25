"use server";

import { revalidatePath } from "next/cache";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { MEDIA_TYPES, type MediaType } from "@/lib/media-types";
import { resolveCircleAccess } from "@/lib/membership";
import { isFeatureEnabled } from "@/lib/flags/server";
import { getProvider } from "@/lib/providers";
import {
  findCanonicalProviderMatch,
  normalizeProviderResult,
} from "@/lib/providers/validation";
import { logDiagnostic } from "@/lib/errors";
import { chatJson, getLlmConfig } from "@/lib/llm/client";
import { buildExtractPrompt } from "@/lib/llm/prompt";
import { reserveLlmUsage } from "@/lib/llm/rate-limit";
import {
  foldTitleKey,
  MAX_CANDIDATES,
  parseAndValidateLlmOutput,
  validateRawDump,
} from "@/lib/llm/validate";
import type { CandidateDraft, ExtractResult, ProposeEntry, ProposeResult } from "@/lib/llm/types";
import type { ActionResult } from "@/types/actions";
import type {
  GroupMembersResponse,
  GroupsResponse,
  TitlesResponse,
} from "@/types/pocketbase-types";

const LLM_FEATURE_DISABLED = "Title extraction from text is not enabled yet.";
const LLM_NOT_CONFIGURED = "Title extraction is not configured on this server yet.";
const LLM_REQUEST_FAILED = "The AI assistant could not be reached. Please try again.";
const LLM_EMPTY_DUMP = "The text is empty.";
const LLM_DUMP_TOO_LARGE = "The text is too large to process in one go.";
const LLM_RATE_LIMITED = "Too many extraction requests. Please try again later.";
const LLM_INPUT_LIMITED = "Your extraction input budget has been reached. Please try again later.";
const LLM_NO_TITLES =
  "No recommended titles could be extracted from this text. Try pasting a more specific list.";

const CHUNK_SIZE = 25;

export async function extractTitlesFromDump(text: string): Promise<ActionResult<ExtractResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in to extract titles." };
  }

  const enabled = await isFeatureEnabled("llm_extract");
  if (!enabled) {
    return { success: false, error: LLM_FEATURE_DISABLED };
  }
  const config = getLlmConfig();
  if (!config) {
    return { success: false, error: LLM_NOT_CONFIGURED };
  }

  const dumpCheck = validateRawDump(text);
  if (!dumpCheck.ok) {
    return {
      success: false,
      error: dumpCheck.reason === "too_large" ? LLM_DUMP_TOO_LARGE : LLM_EMPTY_DUMP,
    };
  }

  try {
    const pb = await getSuperuserClient();
    const usage = await reserveLlmUsage(pb, session.id, dumpCheck.clean.length);
    if (!usage.allowed) {
      return {
        success: false,
        error: usage.reason === "input" ? LLM_INPUT_LIMITED : LLM_RATE_LIMITED,
      };
    }

    const prompt = buildExtractPrompt(dumpCheck.clean);

    let content: string | null;
    try {
      content = await chatJson(config, prompt.system, prompt.user);
    } catch (err) {
      // S2-esque: never log the dump — length + model only.
      const diag = logDiagnostic(err, {
        action: "llm-extract/chat",
        dumpLength: dumpCheck.clean.length,
        model: config.model,
      });
      return { success: false, error: LLM_REQUEST_FAILED, traceId: diag.traceId };
    }

    if (!content) {
      return { success: false, error: LLM_REQUEST_FAILED };
    }

    const { candidates, dropped } = parseAndValidateLlmOutput(content);
    if (candidates.length === 0) {
      return { success: false, error: LLM_NO_TITLES };
    }

    // Reconcile every candidate against the real media providers (top 3),
    // independently: a failing provider must not sink the whole batch.
    const drafts: CandidateDraft[] = [];
    for (let i = 0; i < candidates.length; i += 3) {
      const chunk = candidates.slice(i, i + 3);
      const results = await Promise.all(
        chunk.map(async (candidate): Promise<CandidateDraft> => {
          const query = candidate.creator
            ? `${candidate.title} ${candidate.creator}`.trim()
            : candidate.title;
          let matches: CandidateDraft["matches"] = [];
          try {
            matches = (await getProvider(candidate.mediaType).search(query))
              .map((result) => normalizeProviderResult(candidate.mediaType, result))
              .filter((result): result is NonNullable<typeof result> => result !== null)
              .slice(0, 3);
          } catch {
            matches = [];
          }
          return { raw: candidate, matches };
        }),
      );
      drafts.push(...results);
    }

    const memberships = await pb
      .collection("group_members")
      .getFullList<GroupMembersResponse<{ group?: GroupsResponse }>>({
        filter: pb.filter("user = {:user}", { user: session.id }),
        expand: "group",
        fields: "group,expand.group.id,expand.group.name",
        sort: "created",
      });
    const userGroups = memberships
      .map((m) => ({ id: m.expand?.group?.id ?? m.group, name: m.expand?.group?.name ?? "" }))
      .filter((g) => g.id && g.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, data: { candidates: drafts, userGroups, dropped } };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "llm-extract", dumpLength: text.length });
    return { success: false, error: LLM_REQUEST_FAILED, traceId: diag.traceId };
  }
}

export async function proposeExtractedTitles(
  groupId: string,
  entries: ProposeEntry[],
): Promise<ActionResult<ProposeResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in to propose titles." };
  }
  if (!(await isFeatureEnabled("llm_extract"))) {
    return { success: false, error: LLM_FEATURE_DISABLED };
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { success: false, error: "No titles selected to add." };
  }
  if (entries.length > MAX_CANDIDATES) {
    return {
      success: false,
      error: `Add limit exceeded: a maximum of ${MAX_CANDIDATES} titles can be added at once.`,
    };
  }

  try {
    const access = await resolveCircleAccess(groupId, session.id);
    if (!access.canPropose) {
      return { success: false, error: "You do not have permission to propose media in this circle" };
    }

    const pb = await getSuperuserClient();
    const existing = await pb.collection("titles").getFullList<TitlesResponse>({
      filter: pb.filter("group = {:group}", { group: groupId }),
      fields: "id,title,mediaType,externalSource,externalId",
    });

    const existingExt = new Set(
      existing
        .filter((t) => t.externalSource && t.externalId)
        .map((t) => `${t.externalSource}:${t.externalId}`),
    );
    const existingTitles = new Set(
      existing.map((t) => foldTitleKey(t.mediaType, t.title)),
    );

    const toInsert: Array<{
      group: string;
      mediaType: MediaType;
      externalSource: string;
      externalId: string;
      title: string;
      creator: string | null;
      coverUrl: string | null;
      metadata: Record<string, unknown> | null;
      status: "proposed";
      addedBy: string;
    }> = [];
    const seenTitles = new Set<string>();
    const seenExt = new Set<string>();
    let skippedCount = 0;

    // Resolve candidate provider searches concurrently (R2-Q03)
    const resolvedCandidates = await Promise.all(
      entries.map(async (entry) => {
        if (!entry || !MEDIA_TYPES.includes(entry.mediaType)) {
          return { status: "skipped" as const };
        }

        const rawTitle = entry.match?.title ?? entry.custom?.title;
        const title = typeof rawTitle === "string" ? rawTitle.slice(0, 300).trim() : "";
        if (!title) {
          return { status: "skipped" as const };
        }

        const titleKey = foldTitleKey(entry.mediaType, title);
        const customTarget = !entry.match;

        let externalSource: string;
        let externalId: string;
        let creator: string | null = null;
        let coverUrl: string | null = null;
        let metadata: Record<string, unknown> | null = null;
        let resolvedTitleStr = title;

        if (entry.match) {
          const suppliedMatch = normalizeProviderResult(entry.mediaType, entry.match);
          if (!suppliedMatch) {
            return { status: "skipped" as const };
          }

          const query = `${suppliedMatch.title} ${suppliedMatch.creator ?? ""}`.trim();
          let canonicalMatch: ReturnType<typeof normalizeProviderResult> = null;
          try {
            const results = await getProvider(entry.mediaType).search(query);
            canonicalMatch = findCanonicalProviderMatch(entry.mediaType, suppliedMatch, results);
          } catch (err) {
            logDiagnostic(err, {
              action: "proposeExtractedTitles/provider-validation",
              groupId,
              mediaType: entry.mediaType,
            });
          }
          if (!canonicalMatch) {
            return { status: "skipped" as const };
          }

          externalSource = canonicalMatch.externalSource;
          externalId = canonicalMatch.externalId;
          resolvedTitleStr = canonicalMatch.title;
          creator = canonicalMatch.creator ?? null;
          coverUrl = canonicalMatch.coverUrl ?? null;
          metadata = canonicalMatch.metadata ?? null;
        } else {
          externalSource = "custom";
          externalId = `custom_${crypto.randomUUID()}`;
          creator =
            typeof entry.custom?.creator === "string"
              ? entry.custom.creator.trim().slice(0, 300) || null
              : null;
        }

        return {
          status: "valid" as const,
          entry,
          titleKey,
          customTarget,
          externalSource,
          externalId,
          title: resolvedTitleStr,
          creator,
          coverUrl,
          metadata,
        };
      }),
    );

    for (const res of resolvedCandidates) {
      if (res.status === "skipped") {
        skippedCount++;
        continue;
      }

      const extKey = `${res.externalSource}:${res.externalId}`;
      if (
        existingTitles.has(res.titleKey) ||
        seenTitles.has(res.titleKey) ||
        (!res.customTarget && (existingExt.has(extKey) || seenExt.has(extKey)))
      ) {
        skippedCount++;
        continue;
      }

      seenTitles.add(res.titleKey);
      if (!res.customTarget) seenExt.add(extKey);

      toInsert.push({
        group: groupId,
        mediaType: res.entry.mediaType,
        externalSource: res.externalSource,
        externalId: res.externalId,
        title: res.title,
        creator: res.creator,
        coverUrl: res.coverUrl,
        metadata: res.metadata,
        status: "proposed",
        addedBy: session.id,
      });
    }

    let addedCount = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (record) => {
          try {
            await pb.collection("titles").create(record);
            addedCount++;
          } catch (err) {
            if (isValidationNotUnique(err)) {
              skippedCount++;
              return;
            }
            skippedCount++;
            logDiagnostic(err, { action: "proposeExtractedTitles/create", groupId });
          }
        }),
      );
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: { addedCount, skippedCount } };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "proposeExtractedTitles", groupId });
    return { success: false, error: "Failed to add titles to the group", traceId: diag.traceId };
  }
}
