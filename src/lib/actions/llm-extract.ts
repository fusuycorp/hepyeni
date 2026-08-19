"use server";

import { revalidatePath } from "next/cache";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { MEDIA_TYPES, type MediaType } from "@/lib/media-types";
import { resolveCircleAccess } from "@/lib/membership";
import { isFeatureEnabled } from "@/lib/flags/server";
import { getProvider } from "@/lib/providers";
import { logDiagnostic } from "@/lib/errors";
import { chatJson, getLlmConfig } from "@/lib/llm/client";
import { buildExtractPrompt } from "@/lib/llm/prompt";
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
const LLM_NO_TITLES =
  "No recommended titles could be extracted from this text. Try pasting a more specific list.";

const CHUNK_SIZE = 25;

export async function extractTitlesFromDump(text: string): Promise<ActionResult<ExtractResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Please sign in to extract titles." };
  }

  const config = getLlmConfig();
  const enabled = await isFeatureEnabled("llm_extract");
  if (!enabled) {
    return { success: false, error: LLM_FEATURE_DISABLED };
  }
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
            matches = (await getProvider(candidate.mediaType).search(query)).slice(0, 3);
          } catch {
            matches = [];
          }
          return { raw: candidate, matches };
        }),
      );
      drafts.push(...results);
    }

    const pb = await getSuperuserClient();
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

    for (const entry of entries) {
      if (!entry || !MEDIA_TYPES.includes(entry.mediaType)) {
        skippedCount++;
        continue;
      }

      const title = (entry.match?.title ?? entry.custom?.title ?? "")
        .slice(0, 300)
        .trim();
      if (!title) {
        skippedCount++;
        continue;
      }

      const titleKey = foldTitleKey(entry.mediaType, title);
      const customTarget = !entry.match;

      let externalSource: string;
      let externalId: string;
      let creator: string | null = null;
      let coverUrl: string | null = null;
      let metadata: Record<string, unknown> | null = null;

      if (entry.match) {
        externalSource = String(entry.match.externalSource ?? "custom").slice(0, 100);
        externalId = String(entry.match.externalId ?? "").slice(0, 200);
        creator = entry.match.creator ? String(entry.match.creator).slice(0, 300) : null;
        coverUrl =
          entry.match.coverUrl && /^https?:\/\//i.test(entry.match.coverUrl)
            ? entry.match.coverUrl.slice(0, 2000)
            : null;
        metadata = entry.match.metadata
          ? { ...(entry.match.metadata as Record<string, unknown>) }
          : null;
      } else {
        externalSource = "custom";
        externalId = `custom_${crypto.randomUUID()}`;
        creator = entry.custom?.creator?.trim().slice(0, 300) || null;
      }

      const extKey = `${externalSource}:${externalId}`;
      if (
        existingTitles.has(titleKey) ||
        seenTitles.has(titleKey) ||
        (!customTarget && (existingExt.has(extKey) || seenExt.has(extKey)))
      ) {
        skippedCount++;
        continue;
      }

      seenTitles.add(titleKey);
      if (!customTarget) seenExt.add(extKey);

      toInsert.push({
        group: groupId,
        mediaType: entry.mediaType,
        externalSource,
        externalId,
        title,
        creator,
        coverUrl,
        metadata,
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
            throw err;
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