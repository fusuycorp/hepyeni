import { describe, expect, it } from "bun:test";
import { reserveLlmUsage, type LlmUsageLimits } from "@/lib/llm/rate-limit";

function makeUsagePb() {
  const ids = new Set<string>();
  const records: Array<Record<string, unknown>> = [];
  return {
    records,
    collection(name: string) {
      if (name !== "llm_usage") throw new Error(`unexpected collection: ${name}`);
      return {
        create: async (record: Record<string, unknown>) => {
          if (ids.has(String(record.id))) {
            const error = Object.assign(new Error("duplicate"), {
              status: 400,
              response: { data: { id: { code: "validation_not_unique" } } },
            });
            throw error;
          }
          ids.add(String(record.id));
          records.push(record);
          return record;
        },
        delete: async (id: string) => {
          ids.delete(id);
        },
      };
    },
  };
}

const limits: LlmUsageLimits = {
  windowMs: 60_000,
  maxRequests: 2,
  maxInputChars: 20_000,
  costUnitChars: 10_000,
};

describe("PocketBase-backed LLM limiter", () => {
  it("reserves request and input-cost slots durably", async () => {
    const pb = makeUsagePb();

    const result = await reserveLlmUsage(pb as never, "user-1", 10_001, 123_456, limits);

    expect(result).toEqual({ allowed: true });
    expect(pb.records).toHaveLength(3);
    expect(pb.records.map((record) => record.kind).sort()).toEqual(["input", "input", "request"]);
  });

  it("enforces request and cost caps under concurrent reservations", async () => {
    const pb = makeUsagePb();

    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        reserveLlmUsage(pb as never, "user-1", 10_001, 123_456, limits),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(results.filter((result) => !result.allowed)).toHaveLength(2);
  });
});
