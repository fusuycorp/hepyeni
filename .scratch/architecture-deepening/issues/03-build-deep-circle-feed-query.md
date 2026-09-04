# 03: Build Deep Circle Feed Query Module

**What to build:** Create a deep circle feed retrieval module (e.g. `src/lib/queries/circle-feed.ts` or deepening `group-titles.ts`) that presents a minimal interface `fetchCircleFeed(groupId, session)` to callers. Behind this interface, encapsulate the entire multi-collection fetch (8 parallel queries), relation-of-relation in-memory joins (ADR-017), user PII stripping (preserving the R2 invariant), blind pick author identity redaction (ADR-012), and 3-section media lifecycle partitioning (`Up Next`, `In Progress`, `Finished` from ADR-015).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] New deep query function (`fetchCircleFeed(groupId: string, session?: Session | null)` and `fetchCircleTitleDetail(groupId, titleId, session?)`) implemented in `src/lib/queries/circle-feed.ts`.
- [x] Resolves circle access and executes independent PocketBase queries in parallel via `Promise.all`.
- [x] Handles PocketBase 0.39 relation-of-relation aggregation in-memory without leaking query details to callers.
- [x] Enforces PII projection invariants (user email is never attached; only id, name, avatarUrl).
- [x] Enforces blind pick redactions when `isBlindPickEnabled` is active on proposed titles for non-owners/non-admins.
- [x] Returns structured, fully resolved circle feed view model with titles partitioned into `upNext`, `inProgress`, and `finished`.
- [x] Dedicated test suite (`tests/circle-feed.test.ts`) verifying feed assembly, permission gating, PII projection, and blind pick redaction.
- [x] Verification passes: `bun test && bun x tsc --noEmit`.

## Answer

Implemented `src/lib/queries/circle-feed.ts` exporting `fetchCircleFeed` and `fetchCircleTitleDetail`. This deep module absorbs all 8 collection queries, relation-of-relation in-memory joins, user PII projections, blind-pick author redaction, and 3-section media lifecycle partitioning behind a minimal interface. Created `tests/circle-feed.test.ts` verifying permissions, PII projection, and feed partitioning. Tests and typecheck pass cleanly.

