# Fix Implementation Plan #2 — post round-2 review hardening

Sources: `reviews/code-review-2.md`, `reviews/performance-review-2.md`, `reviews/security-review-2.md`.

Execution model: **file-disjoint clusters**, each in its own managed git worktree, run in
parallel as one async workflow. No two clusters touch the same file, so merges are
conflict-free by construction. The parent applies each captured patch to `main`, then runs
the full ADR-013 verification chain (`bun test && bun x tsc --noEmit && bun next build`)
once on the merged tree before committing.

Per-worker verification (in-worktree): `bun test` + `bun x tsc --noEmit`. Workers do NOT run
`next build` (5 parallel Turbopack builds risk OOM); the parent's merged-tree build is the
authoritative ADR-013 gate. Workers MUST NOT touch `pb_migrations/` or local PocketBase
(`.db`) — regenerating migrations burns the whole budget. Fresh worktrees lack `.next/types/**`
so `tsc` reports a phantom `LayoutProps` error — ignore it (generated at build). Verify patch
capture: `changed: true` + non-empty diff before trusting it.

Name collisions across clusters are pinned as **interfaces in this plan** — signature changes
to shared Server Actions must match exactly.

---

## Cluster 1 — group page payload & review-visibility  (worker key: fix-group-page)

Files: `src/app/groups/[groupId]/page.tsx`, `src/components/group-content-view.tsx`.

- **H1 (data-loss regression)** — `page.tsx:109-113` strips `reviewText` from **every**
  review including the current user's own. Keep `reviewText` on the current member's own
  review (`r.user === session.id`); strip it from all other rows (as today). This restores the
  consumed-tab `ReviewForm` prefill at `group-content-view.tsx:772` (`defaultText={myReview?.reviewText}`)
  and stops a rating-only save from nulling the body. The `r.reviewText && …` branch at
  `group-content-view.tsx:801` becomes dead for non-owner rows — remove it or render a
  title-detail link for those instead.
- **F-2 (guest review/vote leak)** — when `!access.canViewReviews`, do NOT expand
  `votes_via_title`/`reviews_via_title` at all (`expand: "addedBy"` only). Compute the score
  server-side from a lean votes query (`fields: "value,title"`, filter `title in (:…group titles…)`
  or per-title `getList`); keep `userVote` from the same lean source. When `canViewReviews`,
  project the expanded reviewer `user` to `id,name,avatar` (PocketBase returns the full
  `UsersResponse` including `email` — strip it in the record mapping).
- **H-3 / L4 (wire-level projection)** — apply `fields` on the base titles fetch
  (`id,title,creator,mediaType,coverUrl,status,createdAt,addedBy,metadata`). For expanded
  votes/reviews: if PocketBase supports field projection on the `expand`, use it
  (`votes: id,title,user,value`; `reviews: id,rating,user,createdAt,reviewText`-as-needed); if
  not, issue explicit lean `getList` queries inside the same `Promise.all` and attach. Delete
  the JS-strip shim for non-owner reviews once wire-level projection replaces it. Keep the
  `ponytail:` pagination note.
- Keep blind-pick `redactProposedTitles` behavior intact (`moods.ts:180-185` strips
  votes/reviews expands for non-owner/admins) — do not regress it.

Behavior contract: the group-page RSC payload must contain the current user's own
`reviewText` and must NOT contain (a) anyone else's `reviewText`, (b) reviewer/voter identity
or ratings when `!canViewReviews`, (c) expanded user emails.

## Cluster 2 — title page, shelf hoists, mutation guards, dead code  (worker key: fix-progress)

Files: `src/lib/actions/progress.ts`, `src/lib/actions/titles.ts`, `src/lib/actions/votes.ts`,
`src/lib/actions/reviews.ts`, `src/lib/actions/comments.ts`, `src/lib/actions/schedules.ts`,
`src/app/groups/[groupId]/titles/[titleId]/page.tsx`, `src/app/shelf/page.tsx`,
`tests/progress.test.ts`, `tests/comments.test.ts`, `tests/title-detail.test.ts`.

- **H-1** — `getTitleCircleProgress(titleId, groupId)` re-runs `getSession()` +
  `resolveCircleAccess` + a third title fetch (`progress.ts:294-306`). New signature
  `getTitleCircleProgress(titleId, title, groupId, session, access)` — accept the resolved
  record + session + access (mirror P2 `getGroupSchedules`). Update the call site at
  `titles/[titleId]/page.tsx:80` to pass the already-fetched values (page resolves the title
  via `requireTitleInGroup`). ~13 → ~9 round trips / 1 auth refresh.
- **H-2 (shelf)** — `getPersonalShelf(session?)` (`progress.ts:50`) and
  `getUserQuotes(userId?, session?)` (**this cluster owns the call sites in
  `src/app/shelf/page.tsx`; the `marginalia.ts` change is owned by Cluster 3 — see the pinned
  interface below**) accept a pre-resolved session and skip `getSession()` when provided.
  `shelf/page.tsx:20-21` passes the page's session. Removes 2 auth refreshes per shelf render.
- **M-4** — parallelize independent guards in the hottest mutations:
  `voteOnTitle` (votes.ts:33-37: `resolveCircleAccess` + `requireTitleInGroup` → `Promise.all`),
  `markConsumed`/`unmarkConsumed` (titles.ts:216-217: `requireMembership` + `requireTitleInGroup`),
  `addComment` (comments.ts:29-33: same shape), `submitReview` (reviews.ts). No security
  semantics change — the reads are independent and order is irrelevant.
- **H1-defensive (root-cause guard)** — in `submitReview` (reviews.ts:37-38), preserve an
  existing review body when the incoming `reviewText` is empty: if the DB row already has a
  non-empty body and the client sends `""`/whitespace, keep the existing body instead of
  mapping to `null`. This protects against any client-side prefill loss, independent of the
  Cluster 1 fix.
- **L1** — delete dead `searchTitles` action + `SearchTitlesResponse` (`titles.ts:27-58`);
  the client uses `GET /api/titles/search` (ADR-007).
- **L5** — `getTitleCircleProgress` external-source filter (`progress.ts:323-330`): guard
  the `externalSource`/`externalId` vars so falsy values don't produce unbound `pb.filter`
  params on custom rows.
- **L6 (note only)** — `createGroupSchedule` (`schedules.ts:227-249`): add the promised
  `ponytail:` comment noting the non-transactional ceiling (orphan schedule on mid-batch
  milestone failure).
- Regression tests: H-1 signature/threshold (title payload construction), H-2 shelf (actions
  called with session do not re-auth), M-4 guard ordering, submitReview body preservation,
  L5 custom-row filter.

Pinned interface (owned by Cluster 3, consumed by this cluster):

```ts
export async function getUserQuotes(
  userId?: string,
  session?: Session | null,
): Promise<ShelfQuotesResponse<QuoteExpand>[]>
```

- `session` provided → skip `getSession()`. `!session` → `[]` (S1 preserved). `userId`
  omitted → defaults to `session.id`. Behavior otherwise unchanged.
- `shelf/page.tsx` calls `getUserQuotes(undefined, session)`.

## Cluster 3 — quotes leak, provider query redaction, invite bound  (worker key: fix-marginalia)

Files: `src/lib/actions/marginalia.ts`, `src/lib/providers/google-books.ts`,
`src/lib/providers/spotify.ts`, `src/lib/providers/tmdb.ts`, `src/lib/actions/groups.ts`,
`src/app/api/titles/search/route.ts`, `tests/marginalia.test.ts`, `tests/providers.test.ts`,
`tests/invite.test.ts`.

- **F-3 / M1 (quote expand leak)** — `getUserQuotes`/`getCircleQuotes` expand
  `user,progressItem`; `filterQuotesForViewer` filters top-level rows only. The expanded
  `progressItem` ships the author's full private shelf record (`notes`, `rating`, `moods`,
  `currentLabel`, `isSharedWithCircles`) and the `user` expand ships their email. Fix: drop
  `progressItem` from the expand and project the quote record's own `title/creator/mediaType`
  fields instead (project the quote's `titleName` — QuoteCard renders the title, not the shelf
  record); expand `user` only to `id,name,avatar`. Do NOT expand `progressItem` from
  user-scoped or circle-scoped quote queries.
- **H-2 (interface, see Cluster 2)** — implement `getUserQuotes(userId?, session?)` per the
  pinned interface above.
- **F-4 (S2 redaction)** — replace raw `query: cleanQuery` logging with `queryLength` at all
  five sites: `providers/google-books.ts:149,161,172`, `providers/spotify.ts:135`,
  `providers/tmdb.ts:105`, `api/titles/search/route.ts:41` (match the `titles.ts:49` convention).
- **F-5 (invite DDoS)** — `getGroupByInviteCode` (`groups.ts:178-206`) runs unbounded
  `titles.getFullList` on the public `/invite/[code]` page. Cap with a `fields` projection +
  `limit` (e.g. 20) on the preview list; keep the count if the UI shows one.
- Regression tests: no `progressItem`/email in quote responses; `getUserQuotes(session)` skips
  re-auth; provider logs use `queryLength`.

## Cluster 4 — OAuth origin hardening  (worker key: fix-auth)

Files: `src/lib/actions/auth.ts`, `tests/origin.test.ts`, `tests/auth-methods.test.ts`.

- **M3 / F-1 (S6 bypass)** — `signInWithOAuth2` (`auth.ts:111-121`) rebuilds the origin from
  raw `x-forwarded-host`/`proto`/`host` headers, ignoring `APP_URL` and
  `TRUST_FORWARDED_HEADERS`, producing a spoofable OAuth `redirect_uri`/open-redirect
  primitive. `getRequestOrigin` (`session.ts:125`) already accepts a
  `{ headers: { get } }` shape — the Next `headers()` store fits directly. Replace the inline
  host/proto logic with `const origin = getRequestOrigin({ headers: headerStore })` and remove
  the duplicated `0.0.0.0`-only guard. `oauth2RedirectUrl(origin)` unchanged.
- Tests: OAuth URL built with APP_URL set / trust flag on / trust flag off (host-only) /
  hostile forwarded host under no-trust (must be ignored); extend `tests/origin.test.ts`.

## Cluster 5 — i18n parity & importer strings  (worker key: fix-i18n)

Files: `src/lib/importers/index.ts`, `src/app/error.tsx`, `src/app/global-error.tsx`,
`src/app/groups/[groupId]/add/page.tsx`, `src/app/landing-view.tsx`, `src/lib/i18n/types.ts`,
`src/lib/i18n/en.ts`, `src/lib/i18n/tr.ts`, `src/lib/format.ts`, `tests/i18n.test.ts`,
`tests/i18n-exhaustive.test.ts`, `tests/importers.test.ts`, `tests/landing.test.ts`.

- **M2** — `importers/index.ts:296,301` returns Turkish parse errors + raw `err.message`
  rendered verbatim in the dropzone (`import-dropzone.tsx:83,93`). Return a neutral English
  fallback / stable error code with the `ponytail:` error-code mapping; never raw `err.message`.
- **M4** — move inline copy into the `Translations` dictionary (types/en/tr together, enforced
  parity): `groups/[groupId]/add/page.tsx:52-60` and `landing-view.tsx:63-87,376`
  (inline `locale === "tr" ? … : …` notes). For error boundaries (`error.tsx:53-91`,
  `global-error.tsx:50-75`): add a minimal cookie-locale read (`NEXT_LOCALE`/`locale` cookie;
  do NOT call `getServerTranslations` — error boundaries run outside the i18n provider) with a
  bilingual fallback, and a `ponytail:` note explaining the boundary limitation.
- **L3** — `getDisplayName` (`format.ts:9,12`) hardcodes `"Üye"` for nameless users in every
  locale. Make it locale-neutral: return a stable token/empty and let callers translate, or
  accept an explicit fallback label.
- Optional (Low): `auth-method-badges.tsx:66,75,86,96` hardcoded "Google"/"Apple"/"OTP" +
  `translations.passwordAuth.split(" ")[0]` hack → add dedicated dictionary keys. Small, same
  files as C1's UI — include if cheap.
- Regression: `i18n-exhaustive` + `i18n` + `landing` + `importers` tests extended for the new
  keys/strings.

## Cluster 6 — admin pages  (worker key: fix-admin)

Files: `src/app/admin/groups/page.tsx`, `src/app/admin/groups/[groupId]/page.tsx`.

- **M-2** — `admin/groups/page.tsx:16-41`: paginate the groups list (`getList(page, 25)`,
  matching `admin/users`), eliminating the unpaginated `getFullList` and the 2-per-group count
  N+1 (`group_members.getList(1,1)` + `titles.getList(1,1)`).
- **M-1** — `admin/groups/[groupId]/page.tsx:57-61`: apply the H-3-style projection (drop
  `reviews_via_title` bodies; lean `new titles.getFullList` with `fields`).

## Deferred (documented, no change this round)

- L-1 activity page 3× over-fetch; L-2 checkin payload (fields+count); L-3 groups list
  unbounded `titles.getFullList`; L-4 schedules always-fetched on group render — noted with
  `ponytail:` where a file is next touched.
- Deep error-key i18n refactor (`ponytail:` note pattern from C4).

## Verification contract (parent)

1. After the workflow completes, read each child handoff manifest for patch paths; `git apply`
   each patch to `main` in any order (disjoint files ⇒ clean).
2. Run `bun test && bun x tsc --noEmit && bun next build` on the merged tree.
3. Fix any integration issues surfaced by the merged build (expect: cluster surface-area
   interplay around `getUserQuotes` signature and the group-page canViewReviews payload).
4. Commit, then log via `agent-ctx log`.