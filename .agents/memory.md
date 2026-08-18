# Project Memory

## Active Epics & Tasks
- **Current State**: Shipped full 5-phase modular evolution:
  1. **Phase 0 (Titirek Labs & Feature Flags)**: Zero-dependency flag engine (`src/lib/flags/`) with multi-scope evaluation, cookie persistence, and Profile Labs UI card.
  2. **Phase 1 (Universal Data Portability Hub)**: `/shelf/import-export` with streaming CSV parsers for Goodreads, Letterboxd, and StoryGraph, plus Obsidian Markdown ZIP, JSON, and CSV exporters.
  3. **Phase 2 (Dual-Layer Spoiler Protection & Campfires)**: `<SpoilerText>` interactive inline `||spoiler||` blur filters, `milestone_comments` collection, and server-gated pre-checkin milestone campfire discussions.
  4. **Phase 3 (Digital Marginalia & Quote Snaps)**: `shelf_quotes` collection, `<QuoteCard>`, `<AddQuoteDialog>`, and Quotes gallery tab on `/shelf` with dual private/circle sharing.
  5. **Phase 4 (Mood & Pace Folksonomy + Blind Pick Wheel)**: 9 moods and 3 paces taxonomy, `<MoodSelector>`, backlog vibe filters, `<DecisionWheelDialog>` spinning wheel, and blind proposal identity redaction.
  - Complete i18n parity between Turkish (`tr.ts`) and English (`en.ts`), Test-First (TDD) invariant enforced with 229 passing unit tests across 26 test suites.
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
  1. `collection.fields.add(field)` requires an instantiated `core.Field` constructor (passing plain objects `{ type: "json" }` fails with `TypeError: could not convert [object Object] to core.Field`).
  2. Field constructor names mirror the Go structs: `new JSONField({ name: "...", required: false, maxSize: 2000000 })` (all-caps `JSONField`, NOT `JsonField`), `new BoolField(...)`, `new TextField(...)`, `new RelationField(...)`.

