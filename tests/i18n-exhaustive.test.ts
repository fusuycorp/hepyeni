import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("i18n - Exhaustive Structural & Translation Key Parity", () => {
  function compareObjects(
    objA: Record<string, unknown>,
    objB: Record<string, unknown>,
    path = "",
  ) {
    const keysA = Object.keys(objA).sort();
    const keysB = Object.keys(objB).sort();

    for (const key of keysA) {
      const currentPath = path ? `${path}.${key}` : key;
      expect(key in objB).toBe(true);

      const valA = objA[key];
      const valB = objB[key];

      expect(typeof valA).toBe(typeof valB);

      if (typeof valA === "object" && valA !== null) {
        compareObjects(
          valA as Record<string, unknown>,
          valB as Record<string, unknown>,
          currentPath,
        );
      } else if (typeof valA === "string") {
        expect((valA as string).length).toBeGreaterThan(0);
        expect((valB as string).length).toBeGreaterThan(0);

        // Verify interpolation placeholders like {name}, {count}, {type}, {code} match exactly
        const placeholdersA = (valA.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();
        const placeholdersB = ((valB as string).match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();

        expect(placeholdersA).toEqual(placeholdersB);
      }
    }

    for (const key of keysB) {
      expect(key in objA).toBe(true);
    }
  }

  it("has exact 100% key and placeholder parity between EN and TR across all domains", () => {
    compareObjects(
      en as unknown as Record<string, unknown>,
      tr as unknown as Record<string, unknown>,
    );
  });

  it("ensures no translation string is empty or just whitespace", () => {
    function assertNoEmptyStrings(obj: Record<string, unknown>, path = "") {
      for (const [k, v] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${k}` : k;
        if (typeof v === "object" && v !== null) {
          assertNoEmptyStrings(v as Record<string, unknown>, currentPath);
        } else if (typeof v === "string") {
          expect(v.trim().length).toBeGreaterThan(0);
        }
      }
    }

    assertNoEmptyStrings(en as unknown as Record<string, unknown>, "en");
    assertNoEmptyStrings(tr as unknown as Record<string, unknown>, "tr");
  });
});
