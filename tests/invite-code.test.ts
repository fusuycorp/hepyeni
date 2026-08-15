import { describe, expect, it } from "bun:test";
import { generateInviteCode } from "@/lib/invite-code";

describe("generateInviteCode", () => {
  it("generates an 8-character invite code", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
  });

  it("uses only unambiguous alphanumeric characters (no 0, O, 1, I)", () => {
    const validCharset = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(validCharset);
      expect(code).not.toContain("0");
      expect(code).not.toContain("O");
      expect(code).not.toContain("1");
      expect(code).not.toContain("I");
    }
  });

  it("generates unique codes across multiple iterations", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode());
    }
    // With 32^8 possible permutations, 100 iterations should generate 100 distinct codes
    expect(codes.size).toBe(100);
  });
});
