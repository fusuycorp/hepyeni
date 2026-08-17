# Project Memory

## Active Epics & Tasks
- **Current State**: Phase 1-6 completed (Language toggle, FAB trigger, Comments schema & actions, Media comments UI, Localization, QA test suite passing). Full i18n migration done — language toggle now affects page content everywhere, not just nav chrome (was previously cosmetic). `unmarkConsumed` shipped (a consumed title can be moved back to Up Next). Comments UI refinement shipped: lazy per-title fetch on dialog open (replaced the eager `comments_via_title.user` expand on every group page load with a cheap per-title count query), optimistic append with rollback, auto-scroll, own-comment styling, Cmd/Ctrl+Enter submit. CI: `.github/workflows/deploy.yml` actions bumped to Node 24-compatible majors (checkout@v5, docker/* actions current).
- **Core Stack**: Next.js (App Router, Server Actions), TailwindCSS, Base UI, PocketBase (SQLite backend), Bun runtime.

## Core Invariants & Architecture Rules
- **Server-Only PocketBase**: All collections have `null` API rules; mutations and queries run exclusively server-side via `getSuperuserClient()` with strict multi-tenant authorization guards (`requireMembership`, `requireTitleInGroup`, `requireOwner`).
- **Deterministic Record IDs**: Atomic vote toggles use base36 SHA-256 hash of `titleId:userId` for conflict resolution.
- **Provider Resilience**: External media providers implement `MediaProvider` with 8s timeout wrapper (`AbortSignal.timeout(8000)`).
- **i18n Localization**: Cookie synchronization uses `NEXT_LOCALE` / `locale` with dictionary support for TR and EN. `Translations` (`src/lib/i18n/types.ts`) is a fully-required interface (no optional fields) so `en.ts`/`tr.ts` structural parity is compile-time enforced — a new UI string always gets added to `types.ts` + `en.ts` + `tr.ts` together, never one at a time. No component should hardcode a string or import `en`/`tr` directly — always `useTranslations()` (client) / `getServerTranslations()` (server).
- **Public Invite Links & Auto-Join**: `/invite/[code]` is public in `proxy.ts`. It renders circle metadata and proposed media backlog items without comments, reviews, or private voter IDs. Visiting or clicking Join records `pb_pending_invite` cookie; all auth paths (OAuth2, password signup/signin, OTP) auto-join the user to `group_members` upon session creation and redirect directly to `/groups/[groupId]`.
- **Error Management & Developer Diagnostics**: Third-party provider failures (Google Books, TMDB, Spotify, OAuth) are normalized via `AppError` and logged with unique `ERR-xxxxxx` trace IDs. End users see safe, localized error toasts/alerts; technical diagnostic details (stack, endpoint, status code, payload) are accessible via the Developer Diagnostics modal on Profile/Settings and server logs.
- **Resilient Media Search & Zero-Config Fallbacks**: Every media provider implements resilient, unauthenticated public fallbacks (`music` -> iTunes Music, `movie`/`tv` -> iTunes Video, `book` -> Open Library with User-Agent, `podcast` -> iTunes Podcast). All imperative search RPC Server Actions return structured `{ success, results, error, traceId }` objects rather than throwing exceptions across the wire, preventing Next.js 500 RPC crashes.
- **Docker & Reverse-Proxy Invariants**: `getPbUrl()` centralizes PocketBase URL resolution (`PB_URL` -> `http://pocketbase:8090` in production containers -> `http://127.0.0.1:8090` in dev). All middleware and route redirects derive origin from `getRequestOrigin(req)` (inspecting `x-forwarded-host`/`x-forwarded-proto` while filtering internal `0.0.0.0` addresses).




## Domain Vocabulary & Gotchas
- **Circles / Groups**: Media consumption circles where members add, vote on, review, and comment on media titles.
- **Media Types**: `book`, `movie`, `tv`, `music`, `podcast` (repo_map/typegen elsewhere may list `tv_series`/`game` — the actual `MEDIA_TYPES` const in `src/lib/media-types.ts` is `["book", "movie", "tv", "music", "podcast"]`; trust that file over this note if they ever disagree).
- **Title Status**: `proposed` (a.k.a. "Up Next"/backlog) vs `consumed` (a.k.a. "Finished", completed with reviews/ratings) — bidirectional as of `unmarkConsumed`, a consumed title can be moved back to `proposed`.
- **Drift-prone logic**: anything copy-pasted across files (display-name fallbacks, initials, relative-time formatting) has already silently diverged once in this codebase (see ADR history / git log around `refactor: centralize initials/display-name/relative-time helpers`) — prefer a shared helper in `src/lib/` over inlining the same small transform twice.
