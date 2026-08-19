# Project Memory

## Active Epics & Tasks
- **Current State**: Shipped full 5-phase modular evolution:
  1. **Phase 0 (Titirek Labs & Feature Flags)**: Zero-dependency flag engine (`src/lib/flags/`) with multi-scope evaluation, cookie persistence, and Profile Labs UI card.
  2. **Phase 1 (Universal Data Portability Hub)**: `/shelf/import-export` with streaming CSV parsers for Goodreads, Letterboxd, and StoryGraph, plus Obsidian Markdown ZIP, JSON, and CSV exporters.
  3. **Phase 2 (Dual-Layer Spoiler Protection & Campfires)**: `<SpoilerText>` interactive inline `||spoiler||` blur filters, `milestone_comments` collection, and server-gated pre-checkin milestone campfire discussions.
  4. **Phase 3 (Digital Marginalia & Quote Snaps)**: `shelf_quotes` collection, `<QuoteCard>`, `<AddQuoteDialog>`, and Quotes gallery tab on `/shelf` with dual private/circle sharing.
  5. **Phase 4 (Mood & Pace Folksonomy + Blind Pick Wheel)**: 9 moods and 3 paces taxonomy, `<MoodSelector>`, backlog vibe filters, `<DecisionWheelDialog>` spinning wheel, and blind proposal identity redaction.
  - Complete i18n parity between Turkish (`tr.ts`) and English (`en.ts`), Test-First (TDD) invariant enforced with 357 passing unit tests across 31 test suites (including 5 dedicated adversarial fuzzing and security suites with 429,752 assertion calls).
- **Core Stack**: Next.js (App Router, Server Actions, Route Handlers), TailwindCSS, Base UI, PocketBase (SQLite backend), Bun runtime.


## Core Invariants & Architecture Rules
- **Server-Only PocketBase**: All collections have `null` API rules; mutations and queries run exclusively server-side via `getSuperuserClient()` with strict multi-tenant authorization guards (`requireMembership`, `requireTitleInGroup`, `requireOwner`).
- **Deterministic Record IDs**: Atomic vote toggles use base36 SHA-256 hash of `titleId:userId` for conflict resolution.
- **Provider Resilience**: External media providers implement `MediaProvider` with 8s timeout wrapper (`AbortSignal.timeout(8000)`).
- **Nested Comment Replies (+1 Depth Max)**: Comments support nested replies up to exactly 1 level of depth. When a reply targets another reply, `addComment` attaches to the root parent (`parent.parentId || parent.id`), and `organizeCommentsTree` groups replies directly under their respective top-level comment nodes.
- **i18n Localization**: Cookie synchronization uses `NEXT_LOCALE` / `locale` with dictionary support for TR and EN. `Translations` (`src/lib/i18n/types.ts`) is a fully-required interface (no optional fields) so `en.ts`/`tr.ts` structural parity is compile-time enforced — a new UI string always gets added to `types.ts` + `en.ts` + `tr.ts` together, never one at a time. No component should hardcode a string or import `en`/`tr` directly — always `useTranslations()` (client) / `getServerTranslations()` (server).

- **Test-First Development Invariant (TDD)**: For any new feature or capability, **implement exhaustive unit and invariant tests first** (`tests/*.test.ts`). Define boundary conditions, error handling, permission gates, parsing edge cases, and translation parity upfront. Then write the minimal production code to satisfy all tests, and verify 100% test passage (`bun test`) and clean typecheck (`bun x tsc --noEmit`).
- **Public Invite Links & Auto-Join**: `/invite/[code]` is public in `proxy.ts`. It renders circle metadata and proposed media backlog items without comments, reviews, or private voter IDs. Visiting or clicking Join records `pb_pending_invite` cookie; all auth paths (OAuth2, password signup/signin, OTP) auto-join the user to `group_members` upon session creation and redirect directly to `/groups/[groupId]`.
- **Error Management & Developer Diagnostics**: Third-party provider failures (Google Books, TMDB, Spotify, OAuth) are normalized via `AppError` and logged with unique `ERR-xxxxxx` trace IDs. End users see safe, localized error toasts/alerts; technical diagnostic details (stack, endpoint, status code, payload) are accessible via the Developer Diagnostics modal on Profile/Settings and server logs.
- **Resilient Media Search & Zero-Config Fallbacks**: Every media provider implements resilient, unauthenticated public fallbacks (`music` -> iTunes Music, `movie`/`tv` -> iTunes Video, `book` -> Open Library with User-Agent, `podcast` -> iTunes Podcast). All imperative search RPC Server Actions return structured `{ success, results, error, traceId }` objects rather than throwing exceptions across the wire, preventing Next.js 500 RPC crashes.
- **Docker & Reverse-Proxy Invariants**: `getPbUrl()` centralizes PocketBase URL resolution (`PB_URL` -> `http://pocketbase:8090` in production containers -> `http://127.0.0.1:8090` in dev). All middleware and route redirects derive origin from `getRequestOrigin(req)` (inspecting `x-forwarded-host`/`x-forwarded-proto` while filtering internal `0.0.0.0` addresses).




## Domain Vocabulary & Gotchas
- **Circles / Groups**: Media consumption circles where members add, vote on, review, and comment on media titles.
- **Media Types**: `book`, `movie`, `tv`, `music`, `podcast` (repo_map/typegen elsewhere may list `tv_series`/`game` — the actual `MEDIA_TYPES` const in `src/lib/media-types.ts` is `["book", "movie", "tv", "music", "podcast"]`; trust that file over this note if they ever disagree).
- **Title Status**: `proposed` (a.k.a. "Up Next"/backlog) vs `consumed` (a.k.a. "Finished", completed with reviews/ratings) — bidirectional as of `unmarkConsumed`, a consumed title can be moved back to `proposed`.
- **Drift-prone logic**: anything copy-pasted across files (display-name fallbacks, initials, relative-time formatting) has already silently diverged once in this codebase (see ADR history / git log around `refactor: centralize initials/display-name/relative-time helpers`) — prefer a shared helper in `src/lib/` over inlining the same small transform twice.
- **PocketBase JS Migrations Schema Rule**: In `pb_migrations/*.js` executed by PocketBase's Goja runtime:
  1. `new Collection({ fields: [ ... ] })`: The constructor options array expects plain object descriptors: `{ type: "relation" | "text" | "number" | "bool" | "select" | "json" | "date" | "autodate", name: "...", ... }`. Passing class instances like `new RelationField(...)` inside the `fields` option array causes Goja map unmarshaling to drop the fields, leaving columns missing in SQLite.
  2. `collection.fields.add(field)`: Modifying an existing collection requires an instantiated `core.Field` constructor (e.g. `new RelationField(...)`, `new BoolField(...)`, `new JSONField(...)`, `new TextField(...)`). Passing plain objects `{ type: "json" }` to `fields.add()` fails with `TypeError: could not convert [object Object] to core.Field`.


## Critical Invariants (ADR-013)

**`"use server"` file boundary rule** (NEVER violate):
- `src/lib/actions/*.ts` files may export ONLY `async` functions and `export type` re-exports.
- Sync helpers, constants, and pure functions MUST live in `src/lib/*.ts` (e.g. `src/lib/marginalia.ts`, `src/lib/date.ts`, `src/lib/schedules.ts`).
- Even `export { syncFn } from "..."` re-exports inside a `"use server"` file are REJECTED by the Next.js Turbopack compiler.
- `tsc --noEmit` and `bun test` DO NOT catch this — only `next build` does.

**Mandatory pre-commit verification for any change touching `src/`**:
```
bun test && bun x tsc --noEmit && bun next build
```
All three must pass. Skipping `next build` = silently broken production deploy.

## Review-Hardening Invariants (2026-08-18)

- **Deployment proxy contract (S6)**: `getRequestOrigin()` now prefers `APP_URL`; `x-forwarded-host`/`x-forwarded-proto` are honored ONLY when `TRUST_FORWARDED_HEADERS=1|true|on` is set. Without `APP_URL` or the trust flag, a host-header-only request falls back to `http://localhost:3000`. Set `APP_URL` in production before deploying.
- **Auth-methods semantics (C1)**: `getUserAuthMethods().hasPassword/hasOtp` reflect *collection-level* method availability (`listAuthMethods()`), NOT per-user credential state — PocketBase does not expose per-user password presence. UI copy shows "Active"/"Not Connected" accordingly.
- **Group list payload (P1, superseded by round-2 hardening)**: see `Review-Hardening Invariants Round 2` — R1 supersedes the old "strip all reviewText" rule (which caused silent review-body erasure) and the wire-level `fields` projection.
- **Import/export caps**: `batchImportProgress` rejects > 5000 items; `exportShelfData` rejects > 10000 rows; CSV export neutralizes formula-leading cells (`=`, `+`, `-`, `@`, tab, CR) and import neutralizes `notes`/`currentLabel`.
- **Subagent worktree gotchas** (orchestration, not app code): pi-subagents patch capture can silently return a 0-byte patch for a completed child (verify `changed: true` + non-empty diff before trusting it); fresh worktrees lack `.next/types/**` so `tsc` reports a phantom `LayoutProps` error in layout.tsx (ignore; generated at build); forbid workers from local PocketBase setup (`pb_migrations/` regen / `.db` files) — it burns the whole budget.

## Review-Hardening Invariants Round 2 (2026-08-19)

- **R1 Group-page review payload**: the CURRENT member's own `reviewText` ALWAYS ships with the list payload (the consumed-tab `ReviewForm` prefills from it — stripping it like everyone else's caused a data-loss regression where a rating-only save mapped empty→null and erased the body). Other users' bodies never ship; a title-detail link replaces them. `submitReview` (reviews.ts) additionally preserves an existing body when incoming `reviewText` is empty/whitespace — the root-cause guard for the same failure from any client.
- **R2 canViewReviews server gating**: when `!access.canViewReviews` the group page fetches titles with `expand: "addedBy"` ONLY (no votes/reviews at all) and computes score/userVote server-side from a lean votes query. When reviews are visible, the expanded reviewer `user` is projected to `{id,name,avatarUrl}` — full `UsersResponse` records containing `email` never reach the RSC payload. Same rule as the title page (gated on `requireTitleInGroup` + `resolveCircleAccess`).
- **R3 Session-hoist pattern** (mirrors P2 `getGroupSchedules`): `getTitleCircleProgress(titleId, title, groupId, session?, access?)`, `getPersonalShelf(statusFilter?, session?)`, `getUserQuotes(userId?, session?)` all accept the page's already-resolved `session`/`access`/`title` and skip the per-call `getSession()` authRefresh. Server-component pages pass their session; the actions fall back to `getSession()` when omitted. Signature drift between parallel workers is prevented by pinning interfaces in the impl plan.
- **R4 Quote-response projection**: `shelf_quotes` queries (`getUserQuotes`/`getCircleQuotes`/`addQuote`) expand `user` only, and every response is projected through `projectQuoteRecord`/`projectQuoteUser` (`src/lib/marginalia.ts`) — `expand.user` is exactly `{id,name,avatarUrl}`. `progressItem` is NEVER in a quote response: the QR reader simplified the `progressItem` leak (private notes/rating/moods/currentLabel + author email reaching circle members) that `filterQuotesForViewer`'s top-level-only filtering previously allowed through.
- **R5 OAuth origin loop**: BOTH ends honor the S6 contract. `signInWithOAuth2` routes through `buildOAuthInitUrl(authURL, req?)` (`src/lib/pocketbase/session.ts`) → `getRequestOrigin`, so the entry path no longer trusts raw `x-forwarded-host`/proto outside `TRUST_FORWARDED_HEADERS`. Any future OAuth/host-derived origin must go through `getRequestOrigin` — never re-derive from headers inline.
- **R6 Importer errors**: `src/lib/importers/index.ts` returns stable neutral-English constants (`IMPORT_EMPTY_FILE`/`IMPORT_NO_VALID_RECORDS`/`IMPORT_PARSE_FAILED`), never Turkish strings or raw `err.message`. Upgrade path is the error-code + client-side i18n mapping (`ponytail:` note in file).
- **R7 Admin group lists**: `admin/groups` is paginated (`getList(page, 25)`, mirrors `admin/users`); per-group member/title tallies come from ONE lean query per collection via an OR-chain id filter (`buildIdListFilter` in `src/lib/admin-groups.ts`). PocketBase has NO `in` operator — multi-id filters must be OR-chains (`{:id1} ~ {:id2} ...`). The old per-group `getList(1,1)` tallies (2N+1 round trips, unbounded) are the anti-pattern.
- **R8 PB query capabilities (runtime-VERIFIED)**: verified against PB 0.39.11 via a disposable Docker instance (prod untouched). Top-level expand-field projection works (`expand.votes_via_title.*`, top-level `fields=expand.rel.name`); relation dot-FILTERS work (`title.group = "gid"`, compound `user = "x" && title.group = "gid"`, OR-chain id filters); top-level projection on a TRILL-LEVEL expanded relation does NOT — `expand.reviews_via_title.user.*` in `fields` returns bare user ids WITH NO `.expand.user`. ALWAYS use a lean per-collection `getList` query inside the same `Promise.all` for relation-of-relation data (the pattern group-titles.ts uses for reviews).
- **R9 LLM integration is env-gated + feature-flagged, output untrusted**: the `llm_extract` feature (`src/lib/llm/*`, `src/lib/actions/llm-extract.ts`) runs ONLY when the `llm_extract` flag is enabled AND `LLM_API_KEY` is set — the server actions return early otherwise (`LLM_FEATURE_DISABLED`/`LLM_NOT_CONFIGURED`). The LLM client (`src/lib/llm/client.ts`) is a zero-dependency OpenAI-compatible `fetch` wrapper (8s `AbortSignal.timeout`, one retry on 429/408/5xx, fail-fast on 400). The model output is treated as untrusted DATA: `src/lib/llm/validate.ts` is the only boundary that turns it into app objects (strict JSON shape, `mediaType ∈ MEDIA_TYPES`, length caps, accent-folding dedupe, injection as content not command). Provider-backed matches are normalized and revalidated server-side before group writes (`src/lib/providers/validation.ts`). The raw user dump is NEVER logged — only length/model (`S2`-esque). Trust caps: 60k input, 25 candidates, 3 provider matches per candidate. `llm_usage` fixed-slot PocketBase reservations enforce per-user request/input budgets across replicas (`src/lib/llm/rate-limit.ts`).

## Patch-application gotchas (round 2)

- `git apply --exclude='src/app/groups/[groupId]/group-content-view.tsx'` silently FAILS to exclude — `[groupId]` in the pathspec is a glob character class, not a literal. The patch applies anyway (harmless here because the hunks were non-overlapping, but the exclude is a lie). Use `git apply --exclude=:(literal)path` (or `--pathspec-from-file` with `:(literal)`) for bracket-containing paths.
- Cross-cluster shared-file merges: when two parallel workers must both touch one file (here: `group-content-view.tsx` — payload rewrite + getDisplayName callers), apply the structural patch first, then hand-reapply the other's minor hunks on the merged tree instead of relying on `git apply --exclude`.

## Activity log

- 2026-08-19 — Runtime-test round 2 (verify R8): disposable PB 0.39.11 in Docker (container `titirek-review-test-pb`, 127.0.0.1:8095; prod swarm service `publicality-titirek-*` untouched — separate container, no shared volumes/network/ports, never ran docker-compose.yml). Seeded users Alice(owner/admin)/Bob, 2 titles, 2 reviews, 2 votes. Proved the R8-fallback pattern: titles query drops `reviews_via_title`, reviews ride a lean `reviews` getList (filter `title.group`, `expand=user`, projected `expand.user.{id,name,avatarUrl}`), own-review bodies via compound `user=x && title.group=y` filter. End-to-end: group page renders reviewer names + per-user body visibility (H1) verified for Alice and Bob on the running app (PORT 3001); admin group detail renders. Committed as df1c398. Seed/verify scripts in /tmp/opencode/{seed,verify-final,fetch-pages}.sh.
- 2026-08-19 — Round-2 review & fixes (clusters via 6 worktrees): committed 1f02174 (fixes), 826d49b (memory docs), a7cdf90 (activity log).
