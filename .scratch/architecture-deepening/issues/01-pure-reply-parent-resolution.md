# 01: Extract Pure Reply Parent-ID Resolution at the Comments Seam

**What to build:** Extract the comment threading +1 depth resolution rule (`parent.parentId || parent.id`) into a pure functional helper in the comments domain module. Update the server action to consume this helper, and update the test suite to import and verify the production function directly rather than maintaining a simulated duplicate helper inside the test file.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Pure helper function `resolveReplyParentId` (or equivalent) exported from `src/lib/comments.ts` that safely collapses nested comment replies to their root parent.
- [x] `addComment` in `src/lib/actions/comments.ts` uses the pure domain function instead of inlining the calculation.
- [x] `tests/comments.test.ts` deletes the duplicate `function resolveParentId` simulation and tests the real domain helper directly across all edge cases (null, empty string, root comment, reply to reply).
- [x] `bun test` passes cleanly.

## Answer

Extracted `resolveReplyParentId(parent: { id: string; parentId?: string | null }): string` to `src/lib/comments.ts`. Replaced the inlined `parent.parentId || parent.id` in `src/lib/actions/comments.ts` with `resolveReplyParentId(parent)`. Replaced the simulated `resolveParentId` in `tests/comments.test.ts` with direct assertions on the production export. Tests passed with zero failures.

