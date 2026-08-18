I've completed a thorough read-only review. I examined the page components, server actions, PocketBase session/query layer, importers/exporters, admin pages, providers, client components, and the PB schema/migrations for index coverage. Here is the performance review.

## Review — Titirek performance

**Method:** traced the group page / shelf / title-detail / activity hot paths, the server-action layer (`src/lib/actions/`), the PocketBase superuser/session layer (`src/lib/pocketbase/`), the import/export pipeline, and checked DB index coverage in `pb_migrations/`. Read-only; no files modified, no shell commands run. All timings are estimates, not measured.

---

### High

**H1. Group page fetches *every* title with *every* vote and *every* review (full records, no projection, no pagination) and ships it all through RSC**
`src/app/groups/[groupId]/page.tsx:84-101`:
```ts
pb.collection("titles").getFullList<TitlesResponse<TitleExpand>>({
  filter: pb.filter("group = {:groupId}", { groupId }),
  expand: "addedBy,votes_via_title,reviews_via_title.user",
  sort: "-createdAt",
})
```
- `votes_via_title` expands all votes for all titles; `reviews_via_title.user` expands every review *including full `reviewText`* (up to 5000 chars each). The consumed-tab list then renders the average + every reviewer inline (`group-content-view.tsx:398`). The proposed-tab list needs only title/creator/type/cover/status/createdAt/addedBy + score + userVote — reviews are entirely unused there.
- Payload grows O(titles × votes × reviews). **Estimate:** a circle with 1000 titles, ~10 votes and ~5 reviews each (many with long review text) → tens of thousands of expanded sub-records and multi-MB of JSON serialized into every group render. This is the single biggest real-world hot-path inefficiency; it matters once a circle grows past a few hundred titles.
- Minimal fix: use `fields` projection (`"id,title,creator,mediaType,coverUrl,status,createdAt,addedBy,metadata"`), drop the `reviews_via_title` expansion from the list (review content belongs on the title-detail page), and keep only vote projection needed for score (`fields:"id,title,user,value"` on `votes_via_title`) plus pagination (`getList` with page/perPage instead of `getFullList`).

**H2. Duplicate auth + access resolution on the group page (two `authRefresh` round trips + two group/membership lookups per render)**
`src/app/groups/[groupId]/page.tsx:30` `getSession()` + `:33` `resolveCircleAccess(...)`, then `:108` calls `getGroupSchedules(groupId)` inside the same `Promise.all`. `src/lib/actions/schedules.ts:118-119` independently runs `getSession()` **and** `resolveCircleAccess(groupId)` again.
- Every `getSession()` is a live PocketBase `authRefresh` network call (per `session.ts`, deliberately not cached). The group page therefore issues ~2 auth refreshes + 2 group `getOne` + 2 membership `getFirstListItem` per render — ~5 redundant HTTP round trips on the app's hottest page, paid on every navigation, whether or not the schedules tab is ever opened.
- Minimal fix: hoist `session`/`access` from the page and pass them into `getGroupSchedules` (or splice its work into the page's existing `Promise.all`). Small, contained diff; removes the duplicated requests.

**H3. `batchImportProgress` is unbounded server-side (no size cap on the incoming `items` array) → runaway DB writes + whole-shelf fetch**
`src/lib/actions/import-export.ts:91-215`:
```ts
if (!Array.isArray(items) || items.length === 0) { ... }
...
const existingRecords = await pb.collection("user_media_progress").getFullList({ filter: user ... });
...
for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
  const chunk = toInsert.slice(i, i + CHUNK_SIZE);
  await Promise.all(chunk.map(async (record) => { await pb...create(record); ... }));
}
```
- The client caps the *file* at 15MB (`import-dropzone.tsx:66`), but the server action itself has **no upper bound on `items.length`**. A fabricated client can post an arbitrarily large array; each item is one `.create()` (25-wide parallel bursts), on top of a `getFullList` of the user's entire existing shelf for dedup. This is the clearest "unbounded/runaway work at a trust boundary" case.
- Minimal fix: reject `items.length > N` (e.g. 5000) server-side with an error message, and mirror the same cap in the UI. One guard, prevents both the write amplification and the dedup fetch.

---

### Medium

**M1. `getCircleQuotes` scans the whole `shelf_quotes` table with no filter**
`src/lib/actions/marginalia.ts:141-166`: `getFullList({ sort: "-createdAt" })` (no filter) then filters in JS by `isSharedWithCircles.includes(circleId)`. Note: grep shows this is currently **not referenced by any page** (latent). If wired into a future circle-quotes view it becomes O(all quotes) per request, unfilterable by an index because `isSharedWithCircles` is a multi-value relation. Flag now to shape that implementation; not an active cost today.

**M2. `getCircleLiveActivity` performs a global full-table scan** (latent, unused by pages)
`src/lib/actions/progress.ts:380-427`: `getFullList({ filter: 'status = "in_progress" && isSharedWithCircles != false' })` fetches every active progress row across *all* users, then filters against the group's member map in JS. The `!= false` predicate on a select/relation field can't use an index. No page imports it (definition only). Same latent note as M1.

**M3. `createGroupSchedule` inserts milestones sequentially — N sequential round trips**
`src/lib/actions/schedules.ts:296-315`: `for (let i = 0; i < validMilestones.length; i++) { ... await pb.collection("schedule_milestones").create(...) }`. A schedule with many milestones = many serialized waits. Since `orderIndex` is stored explicitly, ordering is safe to parallelize.
- Minimal fix: `await Promise.all(validMilestones.map((m, i) => pb...create({ ..., orderIndex: i })))`. Small, safe win.

**M4. Admin pages load whole tables into memory**
- `src/app/admin/users/page.tsx:20-22` — `getFullList` of all users.
- `src/app/admin/groups/page.tsx:31-38` — `getFullList` of **all** groups **and** `getFullList` of **all** group_members **and** all titles, then counts computed in JS.
- Impact: admin-only, but each load is O(entire DB) memory + serialization that grows forever; full-table scans where a count suffices.
- Minimal fix: use PocketBase counts (`getList(1,1).totalItems`) for the member/title tallies and paginate the user-management list.

**M5. `getGroupSchedules` fetches all milestones, all checkins (user-expanded), and all milestone-comment *records* for the whole group, on every group render** (`schedules.ts:126-190`)
- Always computed (as H2 notes, even when the schedules tab is never opened). Comment bodies are fetched but only counts are used to build `commentCountsByMilestone`; checkins are user-expanded for all members. For a busy group this is extra serialization on the same expensive group render.
- Minimal fix: `fields: "id,milestone"` for the comment-count fetch (only the tally is read). Confirm what `group-schedules-card.tsx` actually renders before trimming the checkin expansion (I did not fully verify the card's display needs).

**M6. Shelf and groups-list reads are unbounded `getFullList` with no pagination**
- `src/lib/actions/progress.ts:41-53` (`getPersonalShelf`) returns the user's entire shelf; `shelf-view.tsx` renders all in one grid with no virtualization.
- `src/app/groups/page.tsx:83-97` fetches *all* titles across all of the user's groups just to show `proposed/consumed` counts (mitigated by `fields:"id,group,status"` projection — light-ish but still O(titles-in-groups)).
- Residually fine at a few hundred records; degrades for power users with thousands of shelf items. Minimal fix: cap/paginate shelf, and derive group counts from a count query rather than pulling all title rows.

**M7. Export returns the entire output payload through a Server Action** (`import-export.ts:217-293` returns full JSON/CSV or a base64 zip; `export-card.tsx` decodes client-side)
- For a large shelf (esp. the markdown→zip path, one file per item) the server action response balloons to megabytes. Low frequency, but the largest single object moved through RSC in the app. Minimal fix: stream via a route handler / signed URL instead of a server-action return, or cap rows.

---

### Low

**L1. Cover images served as unoptimized external `<img>`** — `media-cover.tsx:33` intentionally uses plain `<img loading="lazy">` (comment: avoids a provider `remotePatterns` allowlist). TMDB is sized (w342), but Google Books covers default to large zoom levels. No Next Image optimization/in-app cache. Acceptable, documented tradeoff — worth sizing Google Books/Spotify URLs if cover weight ever shows up.

**L2. No HTTP caching on dynamic reads; PB data is uncached on every request** — all group/title/shelf reads hit PocketBase each navigation (no `unstable_cache`/Data Cache layer). Combined with H2, group-page server latency ≈ sum of ~10 round trips. Deliberate design (fresh data + superuser-only reads). Low priority; a per-request caching layer is the standard long-term lever.

**L3. `I18nContext` re-renders its entire subtree on locale change** (`i18n/client.tsx`) with the full `t` object in context. Locale changes are rare (a toggle), so not a hot path — flagging only for completeness. `t` is memoized per locale.

**L4. Regexes reviewed — no ReDoS exposure found (positive finding).** `csv-parser.ts` `parseSafeDate` (`/[;<>'"`]|--|\/\*/`, `/^\d{4}$/`, `.replace(/[/.]/g,"-")`), `normalizeHeaderKey` `/[^a-z0-9]/g`, `exporters/csv-exporter.ts` `/[",\r\n]/`, and `import-export.ts` `normalizeTitleKey` `/[\p{L}\p{N}]/gu` are all linear/anchored. The CSV parser itself is a single-pass char loop. No catastrophic backtracking present.

**L5. Client bundle / provider weight** — `group-content-view.tsx` is a large client component (imports MEDIA_TYPES, MOODS, MOOD_DETAILS, many lucide icons), but lucide tree-shakes and the payload of concern is the server data (H1), not the JS. Not actionable now.

---

### Top 5 worth fixing now
1. **H1** — Group page: project `fields`, drop the full `reviews_via_title` expansion, paginate titles. Biggest real-world win on the main page.
2. **H2** — Remove duplicate `getSession()`/`resolveCircleAccess()` on the group page by passing session/access into `getGroupSchedules`. Cheap, removes ~5 redundant round trips per render.
3. **H3** — Add a server-side item cap to `batchImportProgress`. Security + unbounded-work guard in one place.
4. **M3** — Parallelize milestone creation in `createGroupSchedule` (`Promise.all`). Trivial, removes N sequential waits.
5. **M4** — Replace admin full-table scans with count queries / pagination.

---

Ranked evidence-backed findings are above; everything is traceable to file/line and scope (active vs latent) is called out honestly, including where the fix is genuinely minimal (H2, H3, M3) versus a larger deferred refactor (H1's pagination/tab-lazy-loading).