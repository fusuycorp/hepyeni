# PR #9 Review: Security & PII Leaks

The changes in this PR correctly address the PII leakage issue regarding expanded users. 

**Review Findings:**
- **Code Review**: `pickReviewerUser` (from `src/lib/group-titles.ts`) correctly isolates the fields `id`, `name`, and `avatarUrl`, ensuring sensitive profile fields like `email` are never passed to the client. The usages of `expand.user` across comments (`projectCommentRow`), schedules (`filterMilestoneCommentsForViewer`), and marginalia properly rely on these projection functions.
- **Build & Tests**: The PR branch passes the mandatory verification suite (`bun test`, `bun x tsc --noEmit`, and `bun next build`) after fixing a minor TypeScript typing issue in `src/app/layout.tsx`. All security assertions, including the test suites for adversarial spoiler locks and marginalia, are green.
- **Invariants Check**: The `R2` invariant correctly holds across all relevant domains (comments, quotes, schedules).

**Status:**
Approved. Minor TS fix applied. No further leaks detected.
