# Security Review Round 2 — titirek

**Scope:** `src/` (Next.js App Router + Server Actions, PocketBase/SQLite, Bun). Read-only review — no files modified. Commit `c5899d9` (Cluster 1/2/4/5) and `153fe94` (Cluster 3) from the impl-plan were inspected line-by-line against `reviews/security-review.md` and `reviews/impl-plan.md`, plus a fresh pass over every Server Action/route/middleware for new issues.

**Bottom line:** both fix commits are applied cleanly and the core tenet — *every tenant-scoped mutation/read is guarded, filters are `pb.filter({:key})`-bound, null PB API rules* — remains intact. No high-severity unauthenticated or cross-tenant bypass was found in the fixed paths. Remaining findings are: one hardening gap where the S6 fix was applied to `getRequestOrigin` but *not* to the OAuth entry path, the M-1 residual on the group page (reviews/votes payload reaches guests), a new private-shelf leak through the shared-quote `expand`, and raw search-query logging in the provider layer that undercuts the S2 redaction invariant.

---

## 1. Verified-correct (applied fixes are real and correct)

| Ref | Fix | Verdict | Evidence |
|---|---|---|---|
| S1 | `getUserQuotes` anonymous → `[]`; owner-only unfiltered; others through mutual-circle filter | **Applied-correct** | `src/lib/actions/marginalia.ts:118` (`if (!session) return []`), `:132` owner early-return, `:137-141` mutual-circle `filterQuotesForViewer`. |
| S5 | `getCircleQuotes` anonymous → `[]`; `requireMembership` unconditional; JS `includes` authoritative gate | **Applied-correct** | `marginalia.ts:157-158`, `:169-174`. (Perf half of S5 — `fields` projection — was *not* added; scan narrowed server-side via containment filter only. Perf, not security.) |
| S7 | `pb.filter` binding in progress/schedules/marginalia | **Applied-correct** | `progress.ts:55-61` (`statusFilter`), `schedules.ts:98-100` + `:110-112` (`schedule = {:id}` OR-join), `marginalia.ts:125,138,164`. No string-interpolated filters remain in these files. |
| S2-server | `getDiagnosticsAction` behind `requireAdmin`; raw input redacted at marginalia/progress/titles call sites | **Applied-correct (partial)** | `diagnostics.ts:13-17` (`requireAdmin`, fail-closed `return []`); `marginalia.ts:70,143,176,226-230`, `progress.ts:197-202`, `titles.ts:45-50` all log keys/lengths, never raw payloads. **Partial:** provider layer + API route still log the raw search query (see F-4). |
| S3-title | Title page drops `reviews_via_title` expand when `!canViewReviews` | **Applied-correct** | `groups/[groupId]/titles/[titleId]/page.tsx:59-61` (`titleExpand` conditional). Blind-pick strips `votes_via_title`/`reviews_via_title` from the client-bound copy (`:97-101` → `moods.ts:183-184`); score/userVote computed from pre-redaction records (`:87-107`). |
| S6 | `getRequestOrigin` prefers `APP_URL`; honors forwarded headers only under `TRUST_FORWARDED_HEADERS`; `isValidHost` strict `host[:port]`; 0.0.0.0/localhost fall through | **Applied-correct (bypassed in one caller)** | `session.ts:106-152`. Middleware (`proxy.ts:14`) and OAuth callback (`oauth2-callback/route.ts:18`) both route through it. **Gap:** `signInWithOAuth2` (auth.ts) does not — see F-1. |
| S4 | CSV formula injection neutralized on export *and* import | **Applied-correct** | `csv-exporter.ts:9-22` (`neutralizeFormulaPrefix` in `escapeCsvField` for every field); `import-export.ts:163-168` neutralizes `notes`/`currentLabel` at the boundary (title/creator deliberately left verbatim — goodreads ISBN strings like `=0441…` stay intact, and export neutralizes them anyway → no reachable spreadsheet vector). |
| L-2 / L-2-title | Blind-pick redaction strips proposer + votes/reviews expands for non-owner/admins | **Applied-correct** | `moods.ts:177-187` (`delete expandCopy.votes_via_title/reviews_via_title`), applied on group page (`groups/[groupId]/page.tsx:135-139`) and title page (`titles/[titleId]/page.tsx:97-101`). |
| P1 | Group list no longer ships `reviewText` | **Applied-correct** | `groups/[groupId]/page.tsx:109-113` (destructure-drop of `reviewText`; avg + reviewer names preserved for the consumed tab). |

**Regression check:** none of the previously verified-good guards were weakened. `requireMembership`/`requireOwner`/`requireTitleInGroup`/`requireScheduleInGroup`/`requireMilestoneInGroup`, owner-scoped progress updates, per-request `authRefresh` ban enforcement, admin gating (proxy + layout + every admin action) all intact (`groups.ts`, `progress.ts:152-154,226-228,271-272`, `session.ts:31-54`, `membership.ts`).

---

## 2. Findings by severity

### MEDIUM

**F-1 — S6 hardening bypassed in the OAuth entry path (forwarded-host trust returns via a second code path)**
`src/lib/actions/auth.ts:111-116,121`

`signInWithOAuth2` does **not** call the hardened `getRequestOrigin`; it rebuilds the origin inline from raw headers, trusting `x-forwarded-host`/`x-forwarded-proto` verbatim on every request regardless of `TRUST_FORWARDED_HEADERS` or `APP_URL`:

```ts
const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
const proto = headerStore.get("x-forwarded-proto") || "https";
const origin = host && !host.includes("0.0.0.0") ? `${proto}://${host}` : undefined;
...
redirect(method.authURL + oauth2RedirectUrl(origin));   // attacker-controlled redirect_uri
```

This is the *exact* pattern S6 was written to eliminate (M-4). In a default deployment (no `APP_URL`, no trust flag), `getRequestOrigin` ignores forwarded headers while the login step still honors them — the hardening is inconsistent between the two ends of the OAuth round trip. An attacker who can influence `x-forwarded-host`/`Host` at the ingress steers (`method.authURL + oauth2RedirectUrl`) to an attacker origin, producing a host-header OAuth `redirect_uri`/code-steering and open-redirect primitive. The callback side (`oauth2-callback/route.ts:18`) is fixed and PKCE+state still bind the code exchange, which is why this is Medium not High — but the entry path should honor the same origin policy.

**Fix:** replace the inline host/proto logic with `getRequestOrigin({ headers })` (adapter over the `headers()` store), and pass the *validated* origin into `oauth2RedirectUrl`. Remove the duplicated `0.0.0.0`-only guard.

**F-2 — Reviews/votes identity+rating still ships to guests who lack review visibility (M-1 residual on the group page)**
`src/app/groups/[groupId]/page.tsx:65-71,109-113`

The group page still fetches `expand: "addedBy,votes_via_title,reviews_via_title.user"` whenever `canViewBacklog || canViewFinished` — *unconditionally* with respect to `canViewReviews`. The P1 fix only strips `reviewText` (`:109-113`); the records still carry per-review `rating`/`createdAt` and the expanded reviewer `UsersResponse` (name **and email**), plus per-voter `votes_via_title` identity.

**Exploit scenario:** owner sets `visibility.reviews=false` but keeps the backlog/finished lists public (`DEFAULT` backlog=true, finished=true, reviews=true — disabling reviews leaves the tabs on). A guest opens `/groups/<id>`, and the RSC flight payload still embeds every review's rating + reviewer name/email and every vote. The client components only *render* reviews when `canViewReviews` (`group-content-view.tsx:711,780`), so the guard is purely UI-level — the same gap the title page was fixed for (F-4 in round 1).

**Fix:** mirror the title page: when `!access.canViewReviews`, fetch titles with `expand: "addedBy"` only (or `fields` projection that excludes votes/reviews), and compute the score server-side from a non-expanded votes query. Under blind pick, the existing `redactProposedTitles` already strips these expands from *proposed* titles; extend the server-side trim to the whole payload.

**F-3 — Shared-quote `expand` leaks the quote author's private shelf record (`progressItem`) and profile to every circle member**
`src/lib/actions/marginalia.ts:127,166`

`getUserQuotes`/`getCircleQuotes` fetch with `expand: "user,progressItem"`. When a quote is shared with a circle, every member of that circle receives the author's full `user_media_progress` record as `progressItem` — `notes`, `rating`, `moods`, `currentLabel`, `isSharedWithCircles` — **included even when the author marked that shelf item private** (`isSharedWithCircles: false`). `getTitleCircleProgress` (`progress.ts:349`) and `getCircleLiveActivity` correctly gate on `isSharedWithCircles !== false`, but the quotes expand has no equivalent check, so the private-shelf invariant leaks through the quote-sharing feature. The `user` expand also ships the author's email.

**Exploit scenario:** user A tracks a book with private reading notes; A quotes that entry and shares the quote in a circle; member B calls `getCircleQuotes` and reads A's private notes/rating in `progressItem` — data B could not get from any other endpoint.

**Fix:** either (a) drop `progressItem` from the `expand` (project `id`, `title`, `creator`, `mediaType`, `coverUrl` — what QuoteCard needs) and only expand `user` down to `id,name,avatarUrl`, or (b) run the progress record through the same `isSharedWithCircles !== false || self` visibility check before returning.

### LOW

**F-4 — Provider layer and API route still log the raw user search query to the diagnostics buffer** (S2 invariant undercut)
`src/lib/providers/google-books.ts:149,161,172` · `src/lib/providers/spotify.ts:135` · `src/lib/providers/tmdb.ts:105` · `src/app/api/titles/search/route.ts:41`

`searchTitles` was redacted to `queryLength` (`titles.ts:49`), but every provider fallback and the `/api/titles/search` route log `query: cleanQuery` verbatim. These land in the process-global `diagnosticHistory` (admin-gated reads → low impact now, but H-2's root concern was these buffers) **and** in `console.error` output (server logs / log aggregators). Search terms are user content and can contain PII.

**Fix:** replace `query: cleanQuery` with `queryLength` at all five call sites (or redact via a helper), matching the `titles.ts` convention.

**F-5 — `getGroupByInviteCode` runs unbounded `getFullList` on a public, unauthenticated page**
`src/lib/actions/groups.ts:178-206`

The public invite page (`/invite/[code]`) executes `titles.getFullList({...})` with no row cap (unlike the new 5000/10000 caps on import/export). A circle with a very large backlog makes the invite page arbitrarily slow/heavy for any caller holding a valid code (DoS-adjacent; codes are 40-bit so the entry gate exists). Low, but cheap to fix.

**Fix:** add `getList(1, N)`-style pagination / `{ maxAutoLimit }` or a `fields`+`limit` cap on the preview list, like the group-page `ponytail:` pagination note.

---

## 3. Regression check of prior fixes

- **S1 / S5 / S7 / S2-server / S3-title / S4 / L-2:** applied correctly, no regressions. Filter binding is everywhere (`pb.filter("...{:k}", ...)`); no interpolated PB filters remain in actions.
- **S6:** applied correctly *in `getRequestOrigin`*, but **partially regressed in surface area** — the OAuth sign-in action re-implements the old trusting logic inline (F-1). Middleware + callback are fixed; the entry point is not.
- **S2 redaction:** applied in the action layer; **partial** — providers and the API route still log raw queries (F-4). Not a regression of the old code, but the invariant isn't fully closed.
- **M-1:** **partial** — review *bodies* no longer ship (P1), but reviews/votes identity+rating still reach guests who lack `canViewReviews` on the group page (F-2). Title page fully fixed.

---

## 4. Top 5 worth fixing now

1. **F-1** — Route `signInWithOAuth2` through `getRequestOrigin` (kill the inline forwarded-header trust). Small diff, closes the OAuth redirect_uri primitive at the source.
2. **F-2** — Honor `canViewReviews` server-side on the group page (drop votes/reviews expands), matching the already-fixed title page.
3. **F-3** — Remove the `progressItem` (and lean-out `user`) from the quote expands in `marginalia.ts`, or gate it on the record's `isSharedWithCircles`.
4. **F-4** — Redact the raw query in the four provider call sites + the search API route to restore the S2 invariant (also removes PII from server logs).
5. **F-5** — Cap the invite-page preview list (and note other `getFullList` reads) for boundness parity with the new import/export caps.

---

## Residual risks (unchanged, intent-dependent)

- L-3: guest visibility of member progress notes/ratings in public circles — verify product intent (`getTitleCircleProgress`/`getCircleLiveActivity`; accepted in impl-plan as deferred).
- L-4: no app-layer auth rate limiting (PB built-ins only); `signInWithEmail` self-signup by unknown email remains by design.
- L-5: feature-flag cookies are client-controllable — UX gate only, fine while record-level checks are intact.
- Static review only; no tests/build run (read-only mandate).