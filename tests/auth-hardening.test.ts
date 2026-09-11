import { describe, expect, it } from "bun:test";
import { getUserAuthMethods } from "@/lib/actions/auth";

const authSource = await Bun.file(
  new URL("../src/lib/actions/auth.ts", import.meta.url),
).text();

// Credential, OTP and email entry points are unauthenticated and were entirely
// unlimited: checkRateLimit was imported nowhere in auth.ts. An attacker could
// loop signInWithEmail against a victim to send repeated real OTP mail, burn
// SMTP quota, and pre-register the victim's address (which then returns
// EmailInUse on sign-up).
//
// These assertions are deliberately coarse. Server actions need a request
// context and they redirect() rather than returning a value, so exercising each
// one end-to-end here would require re-implementing the transport. Instead the
// wiring itself is pinned (so silently dropping a limit fails CI) and the
// limiter's own behaviour is covered by tests/rate-limit.test.ts.
describe("auth boundary hardening", () => {
  it("derives the OAuth-method lookup from the session, not a supplied id", () => {
    // Published as a public RPC endpoint, so a userId parameter let any caller
    // read another account's linked OAuth providers through the superuser
    // client. Arity is asserted on the shipped function itself.
    expect(getUserAuthMethods.length).toBe(0);
  });

  it("rate-limits every credential, OTP and email entry point", () => {
    for (const scope of [
      "signInWithEmail",
      "verifyEmailCode",
      "signInWithPassword",
      "signUpWithPassword",
      "requestPasswordReset",
      "confirmPasswordReset",
    ]) {
      expect(authSource).toContain(`enforceAuthRateLimit("${scope}"`);
    }
  });

  it("checks the OTP limit before consuming the OTP cookie", () => {
    // consumeOtpCookie() deletes the cookie, so limiting after it would destroy
    // the user's pending code and force a fresh one on every limited request.
    // Match on the awaited call, not the bare name: the explanatory comment
    // above the limit also mentions consumeOtpCookie().
    const limitIndex = authSource.indexOf(
      'enforceAuthRateLimit("verifyEmailCode")',
    );
    const consumeIndex = authSource.indexOf("await consumeOtpCookie()");

    expect(limitIndex).toBeGreaterThan(-1);
    expect(consumeIndex).toBeGreaterThan(-1);
    expect(limitIndex).toBeLessThan(consumeIndex);
  });
});
