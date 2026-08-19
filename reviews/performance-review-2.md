# Performance Review 2 — post-fix verification (commits c5899d9, 153fe94)

Read-only review of the current tree. Method: traced PB query paths per page/action by reading the
code; counted round trips under the established model (each `getSession()` = one `authRefresh`
network call; `resolveCircleAccess` = group `getOne` + membership `getFirstListItem`; each
`getFullList`/`getList` = one round trip; superuser client is a cached singleton, no per-call cost).
Timings are estimates, not measured.

---

## Verified-correct (applied fixes)

- **P2 — schedules no longer re-auths** — `src/lib/actions/schedules.ts:65-77` accepts optional
  `session`/`access` and only falls back to `getSession()`/`resolveCircleAccess` when absent;
  `src/app/groups/[groupId]/page.tsx:83` passes the page's resolved values. Group page went from ~15
  to ~10 PB round trips per render.
- **P4 — parallel milestone creates** — `schedules.ts:234-249` maps milestones to `create` promises
  and `await Promise.all(milestoneWrites)`. `orderIndex: i` is explicit, so ordering is safe.
- **P6 — comment-count fetch projected** — `schedules.ts:119-121` uses `fields: "id,milestone"` for
  the `milestone_comments` tally.
- **P3 — import cap (server + UI)** — `src/lib/actions/import-export.ts:41,62-67` rejects
  `items.length > 5000` before any DB work; mirrored in `import-dropzone.tsx:74-79`.
- **P7 — export row cap** — `import-export.ts:42,239-244` rejects > 10000 rows before serializing
  the RSC payload. (Caveat: the cap is enforced *after* the full `getFullList` — see M-E.)
- **P5 (users admin) — pagination** — `src/app/admin/users/page.tsx:31-37` uses `getList(page, 25)`
  with `totalItems` as the count; full-table `getFullList` of users removed.
- **getPersonalShelf fields projection** — `src/lib/actions/progress.ts:63-72` projects only the
  shelf-UI fields with a `ponytail:` note deferring pagination/virtualization.
- **Blind-pick redaction (L-2)** — `src/lib/moods.ts:180-185` strips `addedBy`/`votes_via_title`/
  `reviews_via_title` from the client-bound copy for non-owner/admins under blind pick; title page
  applies it at `titles/[titleId]/page.tsx:97-101`.
- **M1 (marginalia)** — `getCircleQuotes` now filters server-side with
  `isSharedWithCircles ~ {:circleId}` (`marginalia.ts:161-167`) instead of a full-table scan.

---

## Findings by severity

### High

**H-1. Title-detail page pays the H2 duplicate-auth bill the group page no longer pays** (same
pattern, un-fixed)
- `src/app/groups/[groupId]/titles/[titleId]/page.tsx:80` calls `getTitleCircleProgress(titleId, groupId)`
  inside the page's `Promise.all`; `src/lib/actions/progress.ts:294-295` independently re-runs
  `getSession()` (an `authRefresh` network call) and `resolveCircleAccess(groupId, ...)`, then
  re-fetches the title at `progress.ts:306`.
- Request path: every title-detail render. Round trips: **~13** — 2 auth refreshes, 2 group `getOne`,
  2 membership queries, **3** title fetches (page `requireTitleInGroup`, page `getOne`, progress
  `getFirstListItem`). The P2 fix in schedules did not extend to progress.
- Suggested fix: mirror P2 — accept an optional `session`/`access` (and ideally the resolved title)
  in `getTitleCircleProgress`, and pass them from `page.tsx:80`. ~4–5 redundant round trips per
  render removed.

**H-2. Shelf page does three auth refreshes per render**
- `src/app/shelf/page.tsx:13,20-21` calls `getPersonalShelf()` and `getUserQuotes(session.id)` in the
  same `Promise.all`, but both actions re-run `getSession()` internally —
  `progress.ts:50` and `marginalia.ts:115` respectively.
- Request path: every `/shelf` render. Round trips: **~6**, of which **3** are authRefresh. The
  session already resolved by the page is thrown away twice.
- Suggested fix: same hoist as P2 — add an optional `session`/`userId` param to `getPersonalShelf`
  and `getUserQuotes` (or a `getSessionFromToken` reuse inside the page) and pass it down. One
  guard, removes 2 round trips and 2 auth-refresh network calls.

**H-3. P1 shipped as a client-side strip, not the planned wire-level `fields` projection** (partial)
- `src/app/groups/[groupId]/page.tsx:66-70` still fetches full title records with
  `expand: "addedBy,votes_via_title,reviews_via_title.user"` and **no `fields` projection**. Votes
  are still fully expanded (plan called for `fields: "id,title,user,value"`); reviews are still
  fully expanded including 5000-char `reviewText` (plan called for `fields: "id,rating,user,createdAt"`).
  The fix strips `reviewText` in JS at `page.tsx:109-113` — so the client-bound RSC payload is
  trimmed, but the PB→Next.js-server payload on every group render is identical to pre-fix: the
  multi-MB wire cost and the expand cost in PocketBase are untouched.
- Request path: group page, hottest page in the app.
- Suggested fix: apply the planned `fields` on the `titles.getFullList` (`id,title,creator,mediaType,
  coverUrl,status,createdAt,addedBy,metadata`), `votes_via_title` (`id,title,user,value`), and
  `reviews_via_title.user` (`id,rating,user,createdAt`) and delete the JS-strip shim. Net payload
  from PB drops to a small fraction; the strip loop at `page.tsx:109-113` disappears.
- UX caveat of the current strip (per-plan, but should be confirmed acceptable): the consumed-tab
  "My Review" `ReviewForm` pre-fill now always gets `defaultText=""`
  (`group-content-view.tsx:770-775`) because the user's own `reviewText` is stripped too — editing
  an existing review on the group page starts empty. Full body still lives on title-detail
  (`title-detail-view.tsx:471,537-541`).

### Medium

**M-1. Admin group-detail page still runs the old H1 full-table scan**
- `src/app/admin/groups/[groupId]/page.tsx:57-61` — `titles.getFullList` with
  `expand: "addedBy,votes_via_title,reviews_via_title.user"`, no `fields`, no pagination: O(titles ×
  votes × reviews) with full `reviewText` shipped. Not touched by P5 (which covered only
  `admin/users` and the `admin/groups` list).
- Suggested fix: same `fields` projection as H-3's suggestion; at minimum drop the `reviews` expand
  bodies and fetch review counts/ratings leanly.

**M-2. `admin/groups` list now makes 2 count queries per group — N+1 amplification** (partial P5)
- `src/app/admin/groups/page.tsx:16-21` still `getFullList`s **all** groups (unpaginated), then
  `:28-41` issues `group_members.getList(1,1)` **and** `titles.getList(1,1)` per group inside
  `Promise.all` — 2N extra round trips per page load. The in-memory tally was fixed, but the query
  count went from 3 to 2N+1.
- Suggested fix: paginate `groups` and cap the per-page groups so N stays small (e.g. perPage 25,
  matching admin/users), or compute member/title tallies with one SQL count per collection via
  PB's count route/`totalItems` on a grouped query instead of per-group lists.

**M-3. `batchImportProgress` dedup fetch is unbounded and unprojected**
- `src/lib/actions/import-export.ts:73-77` — `getFullList` of the user's **entire** shelf with full
  records (including up-to-3000-char `notes`) merely to build the dedup keys
  (`externalSource/externalId/title/creator/mediaType`). A power user with a large shelf pulls every
  field of every row on every import.
- Suggested fix: `fields: "externalSource,externalId,title,creator,mediaType"` on the dedup fetch.
  Also note the 5000-item cap (P3) bounds only the incoming batch, not the existing-shelf scan.

**M-4. Mutation actions serialize 3–5 guard round trips per click**
- `src/lib/actions/votes.ts:33-37` — `resolveCircleAccess` (2 reads) then `requireTitleInGroup` (1
  read) sequentially before the write; `titles.ts:216-217` `requireMembership` + `requireTitleInGroup`
  sequentially; `comments.ts:29-33` same shape. These are the most frequent user interactions (vote/
  consume/comment buttons) and each click costs ~4–5 sequential round trips, two of which are
  independent.
- Suggested fix: `await Promise.all([resolveCircleAccess(...), requireTitleInGroup(...)])` for the
  independent guards in each action. Small, mechanical, no security semantics change.

**M-5. Export cap checked after the full shelf is fetched**
- `src/lib/actions/import-export.ts:232-244` — `getFullList` of the whole shelf happens before the
  10000-row check, so a 50k-row shelf still transfers 50k rows to the server before being rejected.
- Suggested fix: first `getList(1,1).totalItems`; if it exceeds `MAX_EXPORT_ROWS`, reject immediately
  without the full fetch. (P7 is otherwise correct.)

### Low

**L-1. Activity page over-fetches 3× its display cap**
- `src/app/activity/page.tsx:82-114` fetches 30 titles + 30 reviews + 30 comments, then merges and
  slices to 30 at `:157`. ~90 records fetched, ~60 discarded per render. Bounded, but trivially
  avoided with a per-source fetch limit and merge/slice-first, or one feed query.
- Suggested fix: fetch fewer per source (e.g. 10 each) or sort-then-slice before the third query.

**L-2. Checkin payload ships all user-expanded checkins; card renders 4**
- `schedules.ts:113-117` fetches every checkin with `expand: "user"`; `group-schedules-card.tsx:546-559`
  renders only `m.checkins.slice(0, 4)` avatars plus a `+N` count. Expansion is justified (avatars
  need user names/urls), but for a busy milestone the payload is O(members) full user records when a
  `fields` projection on checkins plus a count would cover the display.

**L-3. Groups list still pulls all titles across all the user's groups (carry-over M6)**
- `src/app/groups/page.tsx:56-59` — `titles.getFullList` with `fields: "id,group,status"` is light
  but unbounded O(titles-in-groups) per render. Residual from M6; count queries would bound it.

**L-4. `getGroupSchedules` ships all schedules/milestones on every group render**
- `schedules.ts:82-126` — always computed in the group page `Promise.all` even if the schedules tab
  is never opened (matches the original H2/M5 observation; only the comment-count fields were
  trimmed, P6). Bounded by group scale but dead weight on the default tab. Defer the tab-lazy-load
  refactor; cheap to note.

---

## Regression check of prior fixes

| Fix | Status | Evidence |
|---|---|---|
| P1 group page titles/reviews/votes `fields` projections; `reviewText` stripped | **Partial** | Client-bound strip applied `page.tsx:109-113`; the planned wire-level `fields` on titles/votes/reviews NOT applied (`page.tsx:66-70`) → PB payload unchanged. Pagination `ponytail:` note present (`page.tsx:114-115`). |
| P2 `getGroupSchedules` accepts resolved session/access | **Applied-correct** | `schedules.ts:65-77`, `page.tsx:83` |
| P3 `batchImportProgress` 5000 cap | **Applied-correct** | `import-export.ts:41,62-67` + UI `import-dropzone.tsx:74-79` |
| P4 `Promise.all` milestone creates | **Applied-correct** | `schedules.ts:234-249` |
| P6 comment-count `fields: "id,milestone"` | **Applied-correct** | `schedules.ts:119-121` |
| P7 export 10000 cap | **Applied-correct** (minor caveat → M-5) | `import-export.ts:42,239-244` |
| P5 admin count queries + pagination | **Partial** | `admin/users` correct (`users/page.tsx:31-37`). `admin/groups` list correct in spirit but new 2N count N+1 + unpaginated `getFullList` (`groups/page.tsx:16-41`); `admin/groups/[groupId]` untouched full scan (M-1). |
| getPersonalShelf `fields` projection | **Applied-correct** | `progress.ts:63-72`, `ponytail:` note present |

No prior fix was fully reverted; the two "Partial" marks are scope gaps (wire-level projection never
implemented, admin fix incomplete), not broken behavior.

---

## Top 5 worth fixing now

1. **H-1** — Hoist session/access into `getTitleCircleProgress` (title page ~13 → ~9 round trips,
   2 auth refreshes → 1, 3 title fetches → 1). Same proven P2 pattern, one file.
2. **H-3** — Finish P1 at the wire: `fields` projections on the group page titles/votes/reviews
   fetch; delete the JS-strip shim. This is the actual H1 win the plan intended.
3. **H-2** — Hoist session into `getPersonalShelf`/`getUserQuotes`; shelf page drops 2 auth
   refreshes per render.
4. **M-4** — `Promise.all` the independent guards in `voteOnTitle`/`markConsumed`/`unmarkConsumed`/
   `addComment`; shaves ~2 sequential round trips off every vote/consume/comment click.
5. **M-2 / M-1** — Finish P5: paginate `admin/groups` (removes 2N count N+1) and apply the H-3
   projection to `admin/groups/[groupId]` (removes the last full-table H1 scan).
