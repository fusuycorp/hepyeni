# Fix Implementation Plan — post-review hardening

Sources: `reviews/code-review.md`, `reviews/performance-review.md`, `reviews/security-review.md`.

Execution model: **5 file-disjoint clusters**, each in its own managed git worktree, run in
parallel as one async workflow. No two clusters touch the same file, so merges are
conflict-free by construction. The parent applies each captured patch to `main`, then runs
the full ADR-013 verification chain (`bun test && bun x tsc --noEmit && bun next build`)
once on the merged tree before committing.

Per-worker verification (in-worktree): `bun test` + `bun x tsc --noEmit`. Workers do NOT run
`next build` (5 parallel Turbopack builds on an 8-core/15GiB box risks OOM); the parent's
merged-tree build is the authoritative ADR-013 gate.

## Cluster 1 — auth · session · profile  (worker key: fix-auth)

Files: `src/lib/actions/auth.ts`, `src/lib/pocketbase/session.ts`, `src/lib/invite-code.ts`,
`src/components/auth-method-badges.tsx`, `src/app/profile/page.tsx`,
`src/components/diagnostic-modal.tsx`, `tests/auth-methods.test.ts`, `tests/origin.test.ts`,
`tests/invite-code.test.ts`.

- C1 — `getUserAuthMethods` hardcodes `hasPassword: true, hasOtp: true` (auth.ts:34-35, 46-47).
  Make truthful: per-user password presence if PB exposes it via the superuser client,
  otherwise fall back to collection-level `listAuthMethods()` capability and adjust the UI
  copy (AuthMethodsCard `connected:` prop on profile/page.tsx, badges in auth-method-badges.tsx)
  so OAuth-only users are not shown "Password: Active / OTP: Active". Update tests.
- C9 — `generateInviteCode` modulo bias (invite-code.ts:4-6): rejection sampling over the byte
  instead of `b % 30`.
- S6 — `getRequestOrigin` (session.ts:87-113) trusts `x-forwarded-host`/`x-forwarded-proto`
  verbatim: prefer `APP_URL` env when set, only honor forwarded headers under a documented
  proxy contract, reject/normalize unexpected hosts. Update `tests/origin.test.ts`.
- S2-UI — non-admins should not see the Developer Diagnostics affordance: gate the modal
  button on profile/page.tsx by admin status (server action rejects regardless; this is UX).

## Cluster 2 — marginalia · diagnostics  (worker key: fix-marginalia)

Files: `src/lib/actions/marginalia.ts`, `src/lib/actions/diagnostics.ts`,
`tests/marginalia.test.ts`, `tests/adversarial-spoilers-and-marginalia.test.ts`.

- S1 — `getUserQuotes` (marginalia.ts:116-127) returns private quotes to anonymous callers:
  `if (!session) return []`; only `session.id === targetUserId` gets full records; other
  callers always go through `filterQuotesForViewer` with mutual-circle membership.
- S5 — `getCircleQuotes` (marginalia.ts:139-156) skips `requireMembership` for anonymous
  callers: return `[]` when `!session`, otherwise `requireMembership` unconditionally.
  Add a `fields` projection while touching it (perf M1).
- S7 — replace `user = "${id}"` string interpolation with `pb.filter("user = {:id}", ...)`.
- C5 — replace raw `err.message` passthrough (addQuote/deleteQuote/toggleShareQuoteWithCircle)
  with the ADR-009 pattern: `logDiagnostic` + generic safe message + `traceId`.
- S2-server — `getDiagnosticsAction` (diagnostics.ts:6-11): gate behind `requireAdmin`.
  Redact raw user input from `logDiagnostic` call sites in marginalia.ts (log keys/action,
  not the full `input` payload).
- Add regression tests: anonymous `getUserQuotes` returns `[]`; anonymous `getCircleQuotes`
  returns `[]`; non-member rejects.

## Cluster 3 — progress · schedules · errors · group page  (worker key: fix-progress)

Files: `src/lib/actions/progress.ts`, `src/lib/actions/schedules.ts`,
`src/lib/actions/titles.ts`, `src/lib/errors/index.ts`, `src/lib/moods.ts`,
`src/app/groups/[groupId]/page.tsx`, `src/components/group-content-view.tsx`,
`src/components/group-schedules-card.tsx`, `tests/progress.test.ts`,
`tests/schedules.test.ts`, `tests/errors.test.ts`, `tests/moods-and-wheel.test.ts`,
`tests/adversarial-moods-and-wheel.test.ts`.

- C3 — dedupe `extractErrorMessage` (progress.ts:24-32 / schedules.ts:37-45) into
  `src/lib/errors/index.ts`; import from both. Extend `tests/errors.test.ts`.
- C4 — normalize hardcoded Turkish action error strings in progress.ts/schedules.ts/titles.ts
  to consistent English (matching auth.ts convention). Add a `ponytail:` comment noting the
  error-code + client-side i18n mapping as the upgrade path.
- C6 — `getTitleCircleProgress` (progress.ts:352-357): `p.progressCurrent && p.progressTotal`
  drops 0%; use explicit `typeof === "number"` checks.
- C7 — self-visibility asymmetry: `getTitleCircleProgress` includes own private record but
  `getCircleLiveActivity` does not; align (document or add the self clause).
- S7 — `pb.filter` binding for `statusFilter` (progress.ts:68) and the schedule-id filter
  (schedules.ts:103).
- S2-partial — redact raw user input in `logDiagnostic` call sites in progress.ts/titles.ts.
- P1 — group page (page.tsx:84-101): `fields` projection on titles; `reviews_via_title`
  expand reduced to `fields: "id,rating,user,createdAt"` (avg + reviewer names still work in
  group-content-view.tsx:398, but 5000-char `reviewText` no longer ships); `votes_via_title`
  to `fields: "id,title,user,value"`. Pagination deferred — add `ponytail:` note.
- P2 — hoist `getSession()`/`resolveCircleAccess` on the group page; change
  `getGroupSchedules(groupId, session?, access?)` (schedules.ts:118-119) to accept the already
  resolved session/access instead of re-fetching; update the call site in page.tsx.
- P4 — `createGroupSchedule` (schedules.ts:296-315): `Promise.all` over milestone creates
  (orderIndex is explicit, safe).
- P6 — comment-count fetch in getGroupSchedules: `fields: "id,milestone"`.
- M6-partial — `getPersonalShelf` (progress.ts:41-53): `fields` projection; full pagination/
  virtualization deferred with `ponytail:` note.
- L-2 — blind-pick redaction (moods.ts `redactProposedTitles`): also strip
  `expand.votes_via_title`/`reviews_via_title` for non-owner/admins when blind pick is on.

## Cluster 4 — import · export  (worker key: fix-import-export)

Files: `src/lib/actions/import-export.ts`, `src/lib/exporters/csv-exporter.ts`,
`src/app/shelf/import-export/import-dropzone.tsx`,
`src/app/shelf/import-export/import-export-view.tsx`, `tests/importers.test.ts`,
`tests/adversarial-importers.test.ts`, `tests/exporters.test.ts`.

- S4 — CSV formula injection (csv-exporter.ts:3-14): prefix `'` when trimmed value starts
  with `=`, `+`, `-`, `@`, tab, CR; also strip such prefixes on import in `batchImportProgress`.
  Extend `tests/exporters.test.ts` + `tests/importers.test.ts`.
- P3 — `batchImportProgress` (import-export.ts:91-215): server-side `items.length` cap
  (5000) with an error result; mirror in the import dropzone UI.
- C2 — delete the private `toIsoDate` copy (import-export.ts:34-42); import the guarded
  canonical one from `src/lib/date`.
- C4 — normalize Turkish error strings in import-export.ts to English (same convention).
- P7-minimal — cap export rows with a clear error instead of unbounded payloads; note the
  route-handler/signed-URL refactor as deferred (`ponytail:`).

## Cluster 5 — pages · admin · remaining actions  (worker key: fix-pages)

Files: `src/app/groups/[groupId]/titles/[titleId]/page.tsx`,
`src/components/title-detail-view.tsx`, `src/app/admin/users/page.tsx`,
`src/app/admin/groups/page.tsx`, `src/lib/actions/comments.ts`, `src/lib/actions/votes.ts`,
`src/lib/actions/reviews.ts`, `src/lib/vote-id.ts`, `src/components/decision-wheel-dialog.tsx`,
`tests/title-detail.test.ts`, `tests/comments.test.ts`, `tests/vote-id.test.ts`.

- S3-title — title page (titles/[titleId]/page.tsx:55): drop `reviews_via_title` (and, per
  blind-pick, `votes_via_title`) from the expand when `!canViewReviews`; match the comments
  server-gating pattern already in the group page. Do NOT edit `src/lib/actions/progress.ts`
  (owned by another worker); `getTitleCircleProgress`'s return shape is unchanged.
- L-2-title — title page blind-pick: ensure votes/reviews expands are stripped for
  non-owner/admins when blind pick is enabled (mirrors the moods.ts fix from cluster 3).
- P5 — admin pages: replace full-table `getFullList` scans with count queries
  (`getList(1,1).totalItems`) and paginate the users list (admin/users/page.tsx:20-22,
  admin/groups/page.tsx:31-38).
- C4 — normalize Turkish error strings in comments.ts/votes.ts/reviews.ts to English.
- C8 — `decision-wheel-dialog.tsx:30` `mediaType?: any` → proper union from `MEDIA_TYPES`.
- vote-id.ts:17-38 — fix the misleading "80 bits" comment (loop emits 15 base36 chars ≈ 77.6 bits).

## Deferred (no code change; parent reports)

- Security L-3 — guest visibility of member progress notes/ratings (product decision).
- Security L-4 — app-layer auth rate limiting (feature; PB built-ins only for now).
- Security L-5 — feature-flag cookie gate is client-controllable by design; not a security
  boundary (record-level checks are).
- Perf M7 — export via route handler / signed URL (larger refactor; row cap shipped in C4).
- Perf M6 remainder — shelf pagination/virtualization (ponytail note shipped in C3).
- Perf L1–L5 — documented tradeoffs (cover images, no HTTP cache, i18n context, bundle).
- Deep i18n error-key refactor (ponytail note shipped in C3/C4/C5).
- Security L-6 docker-compose `PB_URL` default → parent applies the one-liner directly.

## Verification contract (parent)

1. After the workflow completes, read each child handoff manifest (artifactPaths) for patch
   paths; `git apply` each patch to `main` in any order (disjoint files ⇒ clean).
2. Run `bun test && bun x tsc --noEmit && bun next build` on the merged tree.
3. Fix any integration issues surfaced by the merged build.
4. Commit, then log via `agent-ctx log`.
