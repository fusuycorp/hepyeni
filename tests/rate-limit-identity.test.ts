import { describe, expect, it } from "bun:test";
import { getClientIp } from "@/lib/rate-limit";

// With no trusted reverse proxy there is no per-client identity to key on. The
// previous implementation returned the literal "127.0.0.1" for every caller, so
// all anonymous traffic shared ONE bucket: 60 requests/min from a single client
// exhausted the limit for the whole internet, letting an attacker blank public
// endpoints (e.g. the invite preview) for everyone.
describe("client identity without a trusted proxy", () => {
  it("never collapses every caller into one shared key", async () => {
    const first = await getClientIp();
    const second = await getClientIp();

    expect(first).not.toBe("127.0.0.1");
    expect(second).not.toBe("127.0.0.1");
    // Distinct keys mean one caller cannot consume another's budget.
    expect(first).not.toBe(second);
  });
});
