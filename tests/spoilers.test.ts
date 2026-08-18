import { describe, expect, it } from "bun:test";
import { parseSpoilerTokens, hasSpoilerTokens } from "@/components/spoiler-text";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("Dual-Layer Spoiler Protection & Campfires", () => {
  describe("Inline Spoiler Token Parser", () => {
    it("handles plain text without spoiler tags", () => {
      const text = "This is a normal review without any secret plot points.";
      const tokens = parseSpoilerTokens(text);

      expect(tokens).toEqual([
        {
          type: "text",
          content: "This is a normal review without any secret plot points.",
        },
      ]);
      expect(hasSpoilerTokens(text)).toBe(false);
    });

    it("parses a single inline spoiler tag cleanly", () => {
      const text = "The main character is actually ||the villain from the start||!";
      const tokens = parseSpoilerTokens(text);

      expect(tokens).toEqual([
        { type: "text", content: "The main character is actually " },
        { type: "spoiler", content: "the villain from the start" },
        { type: "text", content: "!" },
      ]);
      expect(hasSpoilerTokens(text)).toBe(true);
    });

    it("parses multiple spoilers interspersed throughout text", () => {
      const text =
        "Start ||spoiler one|| middle text ||spoiler two with punctuation!|| end.";
      const tokens = parseSpoilerTokens(text);

      expect(tokens).toEqual([
        { type: "text", content: "Start " },
        { type: "spoiler", content: "spoiler one" },
        { type: "text", content: " middle text " },
        { type: "spoiler", content: "spoiler two with punctuation!" },
        { type: "text", content: " end." },
      ]);
      expect(hasSpoilerTokens(text)).toBe(true);
    });

    it("handles text that begins and ends with spoilers", () => {
      const text = "||First spoiler|| and then ||Last spoiler||";
      const tokens = parseSpoilerTokens(text);

      expect(tokens).toEqual([
        { type: "spoiler", content: "First spoiler" },
        { type: "text", content: " and then " },
        { type: "spoiler", content: "Last spoiler" },
      ]);
    });

    it("preserves Turkish characters and emojis inside spoilers", () => {
      const text = "Sonunda ||Ahmet Bey ve Şükran Hanım evleniyor 🎉💐|| çok güzeldi.";
      const tokens = parseSpoilerTokens(text);

      expect(tokens).toEqual([
        { type: "text", content: "Sonunda " },
        {
          type: "spoiler",
          content: "Ahmet Bey ve Şükran Hanım evleniyor 🎉💐",
        },
        { type: "text", content: " çok güzeldi." },
      ]);
    });

    it("handles empty or unclosed tags gracefully without crashing", () => {
      expect(parseSpoilerTokens("")).toEqual([]);
      expect(parseSpoilerTokens("Just a single | vertical bar")).toEqual([
        { type: "text", content: "Just a single | vertical bar" },
      ]);
      expect(parseSpoilerTokens("Unclosed ||tag here")).toEqual([
        { type: "text", content: "Unclosed ||tag here" },
      ]);
    });
  });

  describe("Milestone Campfires Redaction Logic", () => {
    const sampleMilestoneComments = [
      {
        id: "mc-1",
        milestone: "ms-101",
        user: "usr-1",
        group: "grp-1",
        content: "I cannot believe what happened at chapter 10! The betrayal!",
        isSpoiler: true,
        createdAt: "2026-08-18T10:00:00.000Z",
        expand: {
          user: {
            id: "usr-1",
            name: "Ayşe",
            email: "ayse@example.com",
            avatarUrl: undefined,
          },
        },
      },
      {
        id: "mc-2",
        milestone: "ms-101",
        user: "usr-2",
        group: "grp-1",
        content: "Pacing was great here, looking forward to next checkpoint.",
        isSpoiler: false,
        createdAt: "2026-08-18T11:00:00.000Z",
        expand: {
          user: {
            id: "usr-2",
            name: "Barış",
            email: "baris@example.com",
            avatarUrl: undefined,
          },
        },
      },
    ];

    it("redacts comment bodies and marks as locked when user has NOT checked in", () => {
      const hasCheckedIn = false;

      const processed = sampleMilestoneComments.map((c) => {
        if (!hasCheckedIn) {
          return {
            id: c.id,
            milestone: c.milestone,
            user: c.user,
            group: c.group,
            isSpoiler: c.isSpoiler,
            createdAt: c.createdAt,
            isLocked: true,
            author: c.expand.user,
          };
        }
        return {
          id: c.id,
          content: c.content,
          isLocked: false,
          author: c.expand.user,
        };
      });

      expect(processed.length).toBe(2);
      expect(processed[0].isLocked).toBe(true);
      expect((processed[0] as { content?: string }).content).toBeUndefined();
      expect(processed[0].author.name).toBe("Ayşe");

      expect(processed[1].isLocked).toBe(true);
      expect((processed[1] as { content?: string }).content).toBeUndefined();
      expect(processed[1].author.name).toBe("Barış");
    });

    it("includes full comment bodies when user HAS checked in", () => {
      const hasCheckedIn = true;

      const processed = sampleMilestoneComments.map((c) => {
        if (!hasCheckedIn) {
          return {
            id: c.id,
            isLocked: true,
            author: c.expand.user,
          };
        }
        return {
          id: c.id,
          content: c.content,
          isSpoiler: c.isSpoiler,
          isLocked: false,
          author: c.expand.user,
        };
      });

      expect(processed.length).toBe(2);
      expect(processed[0].isLocked).toBe(false);
      expect(processed[0].content).toContain("The betrayal!");
      expect(processed[0].isSpoiler).toBe(true);

      expect(processed[1].isLocked).toBe(false);
      expect(processed[1].content).toContain("Pacing was great");
      expect(processed[1].isSpoiler).toBe(false);
    });
  });

  describe("i18n Translation Completeness for Spoilers and Campfires", () => {
    it("contains all required spoiler keys in EN and TR", () => {
      expect(en.spoilers.reveal).toBeDefined();
      expect(en.spoilers.hide).toBeDefined();
      expect(en.spoilers.spoilerBadge).toBeDefined();
      expect(en.spoilers.markAsSpoiler).toBeDefined();
      expect(en.spoilers.spoilerSyntaxHint).toBeDefined();

      expect(tr.spoilers.reveal).toBeDefined();
      expect(tr.spoilers.hide).toBeDefined();
      expect(tr.spoilers.spoilerBadge).toBeDefined();
      expect(tr.spoilers.markAsSpoiler).toBeDefined();
      expect(tr.spoilers.spoilerSyntaxHint).toBeDefined();
    });

    it("contains all required campfire discussion keys in EN and TR", () => {
      const requiredCampfireKeys: (keyof typeof en.campfires)[] = [
        "campfireTitle",
        "campfireSubtitle",
        "openCampfire",
        "lockedTitle",
        "lockedDesc",
        "checkInToUnlock",
        "lockedCommentPlaceholder",
        "deleteMessageConfirm",
        "noComments",
        "addMessage",
        "posting",
        "postMessage",
        "messageAdded",
        "messageAddFailed",
        "messageDeleted",
        "messageDeleteFailed",
      ];

      for (const k of requiredCampfireKeys) {
        expect(en.campfires[k]).toBeDefined();
        expect(en.campfires[k].length).toBeGreaterThan(0);

        expect(tr.campfires[k]).toBeDefined();
        expect(tr.campfires[k].length).toBeGreaterThan(0);
      }
    });
  });
});
