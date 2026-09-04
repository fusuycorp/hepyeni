# Architecture Deepening: HepYeni

## Overview
Refactor shallow modules, misplaced seams, and leaky database orchestration across HepYeni. The goal is to build deep modules with minimal interfaces, high caller leverage, and strong locality, fulfilling the architectural intent of ADR-015, ADR-017, and the `/codebase-design` principles.

## Problem Statement
1. **Server Component Orchestration Sprawl**: `src/app/groups/[groupId]/page.tsx` is 464 lines long and issues 8 parallel PocketBase queries directly in the page component, manually constructing lookup maps to satisfy a shallow transformation interface in `group-titles.ts`. This query projection is duplicated in `src/app/groups/[groupId]/titles/[titleId]/page.tsx`.
2. **Seam Confusion**: State mutations (`joinGroupByCode`, `autoJoinPendingInvite`) reside inside `src/lib/queries/groups.ts`.
3. **Test Surface Mismatch**: The comment reply depth rule (`+1` depth max) is locked inside `addComment`, forcing unit tests in `tests/comments.test.ts` to simulate the logic using a local fake function.

## Deepening Strategy
1. **Comment Threading**: Extract pure functional decision `resolveReplyParentId` into `src/lib/comments.ts` so production actions and unit tests share the exact same interface.
2. **Command-Query Separation**: Relocate group invite mutations to `src/lib/actions/groups.ts`. Keep `src/lib/queries/` strictly read-only.
3. **Deep Circle Feed Query**: Encapsulate multi-collection queries, in-memory relation-of-relation joins, user PII projection, blind pick author redaction, and 3-section lifecycle partitioning behind a single deep query function `fetchCircleFeed(groupId, session)`.
4. **Lean Page Presentation**: Refactor App Router pages to consume the deep feed interface, shedding >300 lines of query plumbing.

## Tickets
- `01-pure-reply-parent-resolution.md`: Extract pure reply parent resolution (no blockers)
- `02-relocate-circle-invite-mutations.md`: Relocate circle invite mutations to actions (no blockers)
- `03-build-deep-circle-feed-query.md`: Build deep circle feed query module (no blockers)
- `04-migrate-pages-to-deep-feed.md`: Migrate group and title pages to deep feed (blocked by 03)
