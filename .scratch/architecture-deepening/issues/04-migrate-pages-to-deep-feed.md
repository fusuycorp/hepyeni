# 04: Migrate Circle and Title Pages to Deep Feed Interface

**What to build:** Refactor `src/app/groups/[groupId]/page.tsx` and `src/app/groups/[groupId]/titles/[titleId]/page.tsx` to consume the new deep feed query interface. Remove the ~300+ lines of raw PocketBase query coordination, manual Map indexing, and duplicate wire projection code from the page files so they become lean Server Component view renderers.

**Blocked by:** 03: Build Deep Circle Feed Query Module

**Status:** resolved

- [x] `src/app/groups/[groupId]/page.tsx` calls the deep feed query module instead of manually orchestrating 8 parallel PocketBase queries and assembling lookup maps.
- [x] `src/app/groups/[groupId]/titles/[titleId]/page.tsx` shares the underlying deep query / projection logic, eliminating duplicate query options and mapping code.
- [x] Group page length shrank from 464 lines to 226 lines; Title detail page shrank from 233 lines to 125 lines.
- [x] All page and component interactions (voting, reviews, comments, progress milestones) work identically.
- [x] Full regression check passes: `bun test && bun x tsc --noEmit && bun next build && bun run lint`.

## Answer

Migrated `src/app/groups/[groupId]/page.tsx` to `fetchCircleFeed` and `src/app/groups/[groupId]/titles/[titleId]/page.tsx` to `fetchCircleTitleDetail`. Stripped out 346 lines of leaked PocketBase query coordination, manual lookup map assembly, and duplicated wire projection logic across the two Server Component pages. Full test suite (568 tests), typecheck, Turbopack build, and ESLint all passed with zero errors.

