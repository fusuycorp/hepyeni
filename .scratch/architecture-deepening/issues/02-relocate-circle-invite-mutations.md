# 02: Relocate Circle Invite Mutations from Queries to Actions

**What to build:** Move state-mutating functions `joinGroupByCode` and `autoJoinPendingInvite` out of the read query module `src/lib/queries/groups.ts` and into the mutation action module `src/lib/actions/groups.ts`. Enforce strict command-query separation so that `src/lib/queries/` remains pure, read-only, and side-effect-free, while `src/lib/actions/` owns mutations, cookies, and cache revalidations.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `joinGroupByCode` and `autoJoinPendingInvite` are relocated out of `src/lib/queries/groups.ts` into a dedicated internal helper module `src/lib/invites.ts` (keeping them off the `"use server"` public RPC export boundary to prevent IDOR parameter spoofing).
- [x] `src/lib/queries/groups.ts` contains only read-only retrieval queries (`getGroupByInviteCode`).
- [x] All call sites (`src/lib/actions/groups.ts`, `src/lib/actions/auth.ts`, `src/app/api/auth/oauth2-callback/route.ts`, and test files) updated to import from `@/lib/invites`.
- [x] Existing invite tests (`tests/invite.test.ts`, `tests/batch1-remediation.test.ts`) continue to pass without regression.
- [x] All checks pass: `bun test && bun x tsc --noEmit`.

## Answer

Created `src/lib/invites.ts` to house `joinGroupByCode` and `autoJoinPendingInvite`. Kept `src/lib/queries/groups.ts` strictly read-only with `getGroupByInviteCode`. Maintained the security boundary ensuring raw `joinGroupByCode` is not exported from a `"use server"` file, while `src/lib/actions/groups.ts` exports the session-verified `joinGroupByCodeAction`. Updated all call sites and test suites. Typecheck and tests pass cleanly.

