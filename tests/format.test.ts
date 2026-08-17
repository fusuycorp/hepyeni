import { describe, expect, it } from "bun:test";
import { getInitials, getDisplayName } from "@/lib/format";

describe("getInitials", () => {
  it("uppercases the first two characters of the name", () => {
    expect(getInitials("yusuf akcakaya")).toBe("YU");
  });

  it("trims surrounding whitespace before slicing", () => {
    expect(getInitials("  Ada Lovelace  ")).toBe("AD");
  });

  it("falls back to email when name is undefined", () => {
    expect(getInitials(undefined, "jane@example.com")).toBe("JA");
  });

  it("falls back to email when name is empty or whitespace-only", () => {
    expect(getInitials("", "jane@example.com")).toBe("JA");
    expect(getInitials("   ", "jane@example.com")).toBe("JA");
  });

  it("returns the 'U' default when both name and email are missing", () => {
    expect(getInitials()).toBe("U");
    expect(getInitials(undefined, undefined)).toBe("U");
    expect(getInitials("", "")).toBe("U");
    expect(getInitials("   ", "   ")).toBe("U");
  });

  it("handles a single-character name without padding", () => {
    expect(getInitials("A")).toBe("A");
  });

  it("preserves non-ASCII (Turkish) characters when uppercasing", () => {
    expect(getInitials("çağla")).toBe("ÇA");
  });
});

describe("getDisplayName", () => {
  it("returns the user's name when present", () => {
    expect(getDisplayName({ name: "Yusuf Akcakaya", email: "y@example.com" })).toBe(
      "Yusuf Akcakaya"
    );
  });

  it("falls back to email when name is missing", () => {
    expect(getDisplayName({ email: "y@example.com" })).toBe("y@example.com");
  });

  it("falls back to email when name is an empty string", () => {
    expect(getDisplayName({ name: "", email: "y@example.com" })).toBe("y@example.com");
  });

  it("returns the Turkish 'Üye' fallback when both name and email are missing", () => {
    expect(getDisplayName({})).toBe("Üye");
    expect(getDisplayName(undefined)).toBe("Üye");
    expect(getDisplayName({ name: "", email: "" })).toBe("Üye");
  });
});
