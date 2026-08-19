import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as nextCacheModule from "next/cache";
import {
  extractTitlesFromDump,
  proposeExtractedTitles,
} from "@/lib/actions/llm-extract";
import * as flagsModule from "@/lib/flags/server";
import * as membershipModule from "@/lib/membership";
import * as providersModule from "@/lib/providers";
import * as sessionModule from "@/lib/pocketbase/session";
import * as superuserModule from "@/lib/pocketbase/superuser";
import type { NormalizedSearchResult } from "@/lib/providers/types";

const canonicalMatch: NormalizedSearchResult = {
  externalSource: "tmdb",
  externalId: "42",
  title: "Canonical Movie",
  creator: "Canonical Director",
  coverUrl: "https://img.example/42.jpg",
  metadata: { releaseDate: "2026-01-01" },
};

type FakeState = {
  created: Array<Record<string, unknown>>;
  createCalls: number;
  failCreateAt?: number;
  providerCalls: string[];
};

let featureFlagEnabled = true;
let canPropose = true;

function makePb(state: FakeState) {
  return {
    filter: (expression: string, params: Record<string, unknown>) =>
      Object.entries(params).reduce(
        (result, [key, value]) => result.replaceAll(`{:${key}}`, JSON.stringify(value)),
        expression,
      ),
    collection(name: string) {
      if (name === "llm_usage") {
        return {
          create: async () => ({ id: "usage" }),
          delete: async () => {},
        };
      }
      if (name === "group_members") {
        return {
          getFullList: async () => [],
        };
      }
      if (name === "titles") {
        return {
          getFullList: async () => [],
          create: async (record: Record<string, unknown>) => {
            state.createCalls++;
            if (state.createCalls === state.failCreateAt) {
              throw new Error("simulated title write failure");
            }
            state.created.push(record);
            return { id: `title-${state.createCalls}`, ...record };
          },
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe("LLM extract server actions", () => {
  beforeEach(() => {
    spyOn(sessionModule, "getSession").mockResolvedValue({
      id: "user-1",
      isAdmin: false,
      name: "User",
      email: "user@example.com",
    } as never);
    featureFlagEnabled = true;
    canPropose = true;
    spyOn(flagsModule, "isFeatureEnabled").mockImplementation(async () => featureFlagEnabled);
    spyOn(membershipModule, "resolveCircleAccess").mockImplementation(async () => ({
      group: { id: "group-1" },
      isOwner: false,
      isMember: true,
      isGuest: false,
      canViewBacklog: true,
      canViewFinished: true,
      canViewReviews: true,
      canViewComments: true,
      canVote: true,
      canComment: true,
      canReview: true,
      canPropose,
    }) as never);
    spyOn(providersModule, "getProvider").mockImplementation(() => ({
      mediaType: "movie",
      search: async (query: string) => {
        actionState.providerCalls.push(query);
        return [canonicalMatch];
      },
    }));
    spyOn(nextCacheModule, "revalidatePath").mockImplementation(() => undefined);
  });

  afterAll(() => {
    mock.restore();
  });

  let actionState: FakeState;

  beforeEach(() => {
    actionState = { created: [], createCalls: 0, providerCalls: [] };
    spyOn(superuserModule, "getSuperuserClient").mockResolvedValue(makePb(actionState) as never);
  });

  it("enforces llm_extract in both extraction and proposal actions", async () => {
    featureFlagEnabled = false;

    const extract = await extractTitlesFromDump("- Canonical Movie");
    const propose = await proposeExtractedTitles("group-1", []);

    expect(extract).toEqual({
      success: false,
      error: "Title extraction from text is not enabled yet.",
    });
    expect(propose).toEqual({
      success: false,
      error: "Title extraction from text is not enabled yet.",
    });
  });

  it("rejects a forged provider match instead of persisting client fields", async () => {
    const result = await proposeExtractedTitles("group-1", [
      {
        mediaType: "movie",
        match: {
          ...canonicalMatch,
          externalId: "forged-id",
          title: "Canonical Movie",
        },
      },
    ]);

    expect(result).toEqual({ success: true, data: { addedCount: 0, skippedCount: 1 } });
    expect(actionState.created).toHaveLength(0);
  });

  it("uses the canonical provider result and preserves custom titles", async () => {
    const result = await proposeExtractedTitles("group-1", [
      {
        mediaType: "movie",
        match: { ...canonicalMatch, creator: "Client supplied creator" },
      },
      {
        mediaType: "book",
        custom: { title: "My Untitled Draft", creator: "My Author" },
      },
    ]);

    expect(result).toEqual({ success: true, data: { addedCount: 2, skippedCount: 0 } });
    expect(actionState.created[0]).toMatchObject({
      externalSource: "tmdb",
      externalId: "42",
      title: "Canonical Movie",
      creator: "Canonical Director",
      coverUrl: "https://img.example/42.jpg",
      metadata: { releaseDate: "2026-01-01" },
    });
    expect(actionState.created[1]).toMatchObject({
      externalSource: "custom",
      title: "My Untitled Draft",
      creator: "My Author",
    });
    expect(actionState.providerCalls).toHaveLength(1);
  });

  it("keeps the circle proposal authorization gate", async () => {
    canPropose = false;

    const result = await proposeExtractedTitles("group-1", [
      { mediaType: "book", custom: { title: "Not allowed" } },
    ]);

    expect(result).toEqual({
      success: false,
      error: "You do not have permission to propose media in this circle",
    });
    expect(actionState.created).toHaveLength(0);
  });

  it("reports successful partial writes instead of converting them into total failure", async () => {
    actionState.failCreateAt = 2;

    const result = await proposeExtractedTitles("group-1", [
      { mediaType: "book", custom: { title: "First" } },
      { mediaType: "book", custom: { title: "Second" } },
    ]);

    expect(result).toEqual({ success: true, data: { addedCount: 1, skippedCount: 1 } });
    expect(actionState.created).toHaveLength(1);
  });
});
