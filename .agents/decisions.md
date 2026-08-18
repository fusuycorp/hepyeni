# Architecture Decisions (ADRs)

## ADR-001: Responsive App Shell & Multi-Breakpoint Layout Strategy
- **Status**: Accepted & Implemented (2026-08-15)
- **Context**: Constraining pages to max-w-md prevented effective usage of widescreen desktop displays.
- **Decision**:
  - Implemented unified `AppShell` responsive boundary.
  - Desktop (`≥768px`): persistent `DesktopSidebar` with group shortcuts, nav links, user profile, theme toggle.
  - Mobile (`<768px`): fixed `BottomNav` with active pill indicators and safe-area insets.
  - Group views: 3-column responsive split (2 cols for backlog/consumed, 1 col for circle details and member roster).
- **Consequences**: Unified navigation across screen sizes, zero per-page layout boilerplate, full accessibility compliance.

## ADR-002: Deterministic SHA-256 Hashing for Atomic Vote Toggling
- **Status**: Accepted & Implemented (2026-08-15)
- **Context**: SQLite-backed PocketBase concurrent vote requests risked duplicate records or state race conditions.
- **Decision**:
  - Compute deterministic 15-character base36 hash of `titleId:userId` as PocketBase record `id` (`voteRecordId`).
  - Serialized creation in SQLite handles duplicate 400 unique constraint by toggling/flipping vote status atomically.
  - Handled `isNotFound` exceptions to avoid uncaught 404s on concurrent delete/create.
- **Consequences**: 100% race-resilient voting without distributed locks.

## ADR-003: Zero Client-Side PocketBase Access & Strict Multi-Tenant IDOR Defense
- **Status**: Accepted & Implemented (2026-08-15)
- **Context**: Direct client SDK access risks leaking multi-tenant data if API rules are misconfigured.
- **Decision**:
  - All PocketBase collections have `null` API rules (superuser only).
  - All queries/mutations execute server-side in Next.js Server Actions using `getSuperuserClient()`.
  - Multi-tenant defense in depth on every server action: session check -> group membership check -> title group check -> owner check for admin actions.
- **Consequences**: Complete protection against IDOR and cross-tenant leakage.

## ADR-004: External Provider Adapter Pattern & Resilience
- **Status**: Accepted & Implemented (2026-08-15)
- **Context**: Multiple disparate media APIs (Google Books, TMDB, Spotify, iTunes) with differing auth flows and response formats.
- **Decision**:
  - Standardized all external providers under `MediaProvider` interface (`search(query): Promise<NormalizedSearchResult[]>`).
  - Wrapped API calls in `AbortSignal.timeout(8000)`.
  - Standardized cover art rendering via `<MediaCover />` with aspect-[2/3] containers and fallback icons.
- **Consequences**: Pluggable provider architecture with predictable timeouts and zero CLS.

## ADR-005: Single Merged Deploy Workflow with Explicit Build-Before-Redeploy Ordering
- **Status**: Accepted & Implemented (2026-08-17)
- **Context**: `deploy.yml` (app image + Dokploy redeploy trigger) and `deploy-pocketbase.yml` (PocketBase image build) were separate workflows, both triggered independently on push to `main`. A commit touching only `pb_migrations/**` could fire deploy.yml's redeploy before deploy-pocketbase.yml's image push finished, leaving the running `pocketbase` service on stale migrations — masked in practice only by the app image's slower build time, not actually enforced.
- **Decision**:
  - Merged into one `deploy.yml` with 4 jobs: `changes` (diffs the pushed commit range to detect `pb_migrations/**`/`Dockerfile.pocketbase` changes) -> `build-app` (always) + `build-pocketbase` (conditional on `changes` output) -> `deploy` (`needs: [build-app, build-pocketbase]`, explicitly tolerating a skipped `build-pocketbase` but not a failed one).
  - Deleted the standalone `deploy-pocketbase.yml`.
- **Consequences**: Redeploy ordering is now enforced by GitHub Actions' `needs` graph instead of incidental to build-time differences. Lost: the old workflow's ability to manually `workflow_dispatch` a PocketBase-image-only rebuild without also rebuilding the app image and triggering a redeploy — acceptable tradeoff, not worth a separate dispatch-input mechanism unless it's actually needed later.

## ADR-006: Reverse-Proxy Dynamic Host Resolution & OAuth Redirect URL Protocol
- **Status**: Accepted & Implemented (2026-08-17)
- **Context**: In containerized Node.js deployments behind reverse proxies (Dokploy, Traefik, Caddy), internal container socket addresses (`0.0.0.0:3000`) caused `NextResponse.redirect(new URL(..., req.nextUrl))` to redirect users to `https://0.0.0.0:3000`, and caused OAuth `redirect_uri` to mismatch the public domain (`https://hepyeni.net/api/auth/oauth2-callback`), failing the Google/Apple token exchange with `redirect_uri_mismatch`.
- **Decision**:
  - Centralized origin resolution into `getRequestOrigin(req)` in `src/lib/pocketbase/session.ts` which extracts `x-forwarded-host`, `x-forwarded-proto`, and filters out `0.0.0.0` addresses.
  - All server-side redirects in middleware (`proxy.ts`) and API routes (`oauth2-callback`) must construct redirect URLs using `new URL(path, origin)` rather than `req.nextUrl`.
  - All OAuth initiation and token exchanges dynamically compute `oauth2RedirectUrl(origin)` based on the request's forwarded headers so the authorization URL and code exchange URI are byte-identical.
## ADR-007: REST API Route Handler for Media Search vs Server Action RPC
- **Status**: Accepted & Implemented (2026-08-17)
- **Context**: Media search previously used a Next.js Server Action (`searchTitles`), causing client queries to execute as POST requests against the active HTML page route (`/groups/[groupId]`). This violated HTTP idempotent read semantics (`GET`), masked network error codes inside 200 OK React Flight streaming chunks, and prevented HTTP transport caching and inspectability.
- **Decision**:
  - Migrated search to a dedicated REST API Route Handler: `GET /api/titles/search?mediaType=...&q=...`.
  - Returned standard JSON payloads with explicit HTTP status codes: `200 OK` for search results, `400 Bad Request` for invalid parameters, `401 Unauthorized` for missing sessions, and `502 Bad Gateway` for upstream provider errors with trace IDs.
  - Multi-tiered book search across Google Books (API key), iTunes Books (zero-config, high-speed 150ms), and Open Library.
- **Consequences**: Standard REST semantics, clean browser DevTools network inspection, transparent HTTP status codes, and multi-tier zero-config provider resiliency.

## ADR-008: Normalized Personal Media Shelf & Relational Circle Schedules Architecture
- **Status**: Accepted & Implemented (2026-08-17)
- **Context**: Users required the ability to log personal media progress (reading pages, TV episodes, listening minutes, custom notes, star ratings) independently of circles, choose whether to share this progress, synchronize their progress seamlessly with any circle consuming the same title, and participate in circle pacing schedules with milestone checkpoints.
- **Decision**:
  - Implemented `user_media_progress` collection indexed on `(user, externalSource, externalId)` for single-source-of-truth progress across all circles.
  - Progress on circle titles resolved automatically by matching either `groupTitle` or `(externalSource && externalId)`.
  - Avoided denormalizing milestones into unindexed JSON blobs. Created normalized 1:N `group_schedules` $\rightarrow$ `schedule_milestones` (`orderIndex`, `targetDate`, `targetUnit`) and normalized `milestone_checkins` junction table with `UNIQUE(milestone, user)` index.
  - **Consequences**: Pure relational normalization, fast indexed milestone progress queries, cross-circle progress syncing, and complete privacy controls (`isSharedWithCircles`).

## ADR-009: Unified ActionResult<T> Pattern, Zero Unhandled Server Action Exceptions & Accessible AlertDialog Invariant
- **Status**: Accepted & Implemented (2026-08-17)
- **Context**: In Next.js production builds, throwing unhandled exceptions across the Server Action RPC boundary causes Next.js to sanitize the error into opaque hashes (`digest: '...'`). Clients receive generic messages, losing field validation details and trace IDs. Additionally, ad-hoc browser `confirm()` and `alert()` calls degraded accessibility and consistency.
- **Decision**:
  - Global Architectural Invariant: Every Server Action in `src/lib/actions/*.ts` must return a typed `ActionResult<T>` (`{ success: true, data: T } | { success: false, error: string, traceId?: string }`) defined in `@/types/actions`.
  - Every error path in Server Actions logs structured diagnostics via `logDiagnostic()` from `@/lib/errors` and returns a reference code (`traceId`).
  - Zero browser `alert()` or `confirm()`. All destructive/confirm actions use the framework-native Base UI `<AlertDialog>` from `@/components/ui/alert-dialog` or `@/components/confirm-action-button`.
  - Strict sub-resource multi-tenant guards: `requireTitleInGroup`, `requireScheduleInGroup`, and `requireMilestoneInGroup` enforced on all nested database mutations.
- **Consequences**: Zero masked production digests, complete error transparency with traceable reference codes, uniform user feedback in toasts without form resets, and accessible confirmation dialogs across the whole application.

## ADR-010: Titirek Labs Feature Flag Engine, Data Portability Hub & Dual-Layer Spoiler Protection
- **Status**: Accepted & Implemented (2026-08-18)
- **Context**: Rapid product evolution requires a safe way to introduce and test experimental capabilities (e.g. Data Portability, Spoilers, Campfires, Marginalia, Moods) without compromising core stability or introducing third-party vendor bloat. Furthermore, users migrating from Goodreads/Letterboxd/StoryGraph needed a zero-friction import path, and communal pacing required strict server-level spoiler guarantees.
- **Decision**:
  - **Feature Flag Engine (`src/lib/flags/`)**: Zero-dependency, multi-scope (`global`, `user`, `circle`) evaluation pipeline resolving environment variables (`FLAG_ENABLE_*`) -> circle settings -> user cookies (`titirek_flags`) -> registry defaults. Integrated via `<FeatureFlagsProvider />`, `useFeatureFlag()`, `isFeatureEnabled()`, and `requireFeature()`.
  - **Data Portability Hub (`/shelf/import-export`)**: Pure zero-dependency RFC 4180 streaming CSV parsers for Goodreads, Letterboxd, and StoryGraph with automatic format detection, interactive preview tables, and lossless exports (full-fidelity JSON, universal CSV, and Obsidian/Logseq Markdown ZIP with YAML frontmatter).
  - **Dual-Layer Spoiler Protection**: Inline `||spoiler||` token parsing with interactive accessible Base UI blur overlays (`<SpoilerText />`), combined with server-side body redaction for `milestone_comments` when the caller has not checked in to that milestone.
- **Consequences**: Zero third-party analytics/flag overhead, full user data sovereignty, leak-proof communal spoiler gating, and self-service opt-in/out for experimental features via Titirek Labs on `/profile`.

## ADR-011: Digital Marginalia, Quote Snaps & Multi-Scope Sharing Matrix
- **Status**: Accepted & Implemented (2026-08-18)
- **Context**: Media consumption involves memorable excerpts, quotations, and passages that users want to clip either privately to their shelf or share across specific reading/viewing circles.
- **Decision**:
  - Created `shelf_quotes` PocketBase collection with `user` relation, optional `progressItem` relation, `titleName` (max 200), `quoteText` (max 3000), `attribution` (max 200), `tags` (JSON), and `isSharedWithCircles` (JSON array of circle IDs).
  - Server actions in `src/lib/actions/marginalia.ts` (`addQuote`, `deleteQuote`, `getUserQuotes`, `getCircleQuotes`, `toggleShareQuoteWithCircle`) enforce `requireFeature("digital_marginalia")`, typed `ActionResult<T>`, traceId diagnostics, and multi-scope privacy filtering.
  - UI includes editorial serif `QuoteCard` with one-click copy and Base UI delete dialog, `AddQuoteDialog` modal for quick passage clipping, and `QuotesTab` gallery integrated into `/shelf` view.
- **Consequences**: Fast indexed queries by user/progressItem, fine-grained circle sharing control, editorial typographic aesthetics, and 100% translation parity.

## ADR-012: Mood & Pace Folksonomy, Blind Pick Identity Redaction & Decision Wheel
- **Status**: Accepted & Implemented (2026-08-18)
- **Context**: Circles often struggle with analysis paralysis when selecting the next group title, and backlog voting can suffer from social bias toward specific recommenders. Additionally, users wanted fine-grained mood and pacing tags for shelf and backlog items.
- **Decision**:
  - **Taxonomy (`src/lib/moods.ts`)**: 9 curated moods (`cozy`, `dark`, `melancholic`, `mind_bending`, `uplifting`, `nostalgic`, `whimsical`, `tense`, `philosophical`) and 3 paces (`slow_burn`, `gentle`, `fast_paced`) with normalization, validation typeguards, and filtering utilities.
  - **Schema & Persistence**: Migration `1755284000_moods_and_blind_pick.js` adds `isBlindPickEnabled` (bool) to `groups`, and `moods` (JSON array) + `pace` (text) to `user_media_progress`. Updated `titles` metadata to carry mood/pace tags for group proposals.
  - **Blind Pick Identity Redaction**: When `isBlindPickEnabled: true`, server and client redact `addedBy` and author identities for proposed backlog titles for non-owner/non-admin members during active voting, preventing social bias while preserving owner transparency.
  - **Decision Wheel**: Tactile SVG/Canvas decision wheel modal sampling top-voted backlog candidates with decelerating physics animation, fair uniform randomizer, and winner reveal modal with direct navigation.
  - **UI Controls**: `<MoodSelector>` multi-select badge picker for add/edit dialogs, mood filter chip bar in `GroupContentView`, and `<BlindPickToggleForm>` in circle settings.
- **Consequences**: Unbiased group voting dynamics, friction-free random selection, expressive folksonomy categorization, and 100% test & translation parity.



## ADR-013: "use server" File Boundary Invariant & Mandatory Build Verification
- **Status**: Accepted & Enforced (2026-08-18)
- **Context**: A class of build failures was introduced and pushed to main undetected. Synchronous utility functions (`parseTags`, `formatAttribution`, `toIsoDate`, `filterMilestoneCommentsForViewer`, etc.) were exported directly from `"use server"` files. The error was invisible to both `bun test` and `bun x tsc --noEmit` — it only surfaced at `next build` time via Turbopack's Server Action constraint enforcement.
- **Why it slipped through**: The pre-commit verification chain was `bun test && bun x tsc --noEmit`. Neither tool checks the Next.js `"use server"` constraint:
  - `tsc` validates TypeScript types only — it has no knowledge of Server Action rules.
  - `bun test` runs unit tests that import modules directly via path aliases, bypassing the Next.js compiler entirely.
  - `next build` is the only tool that enforces the "every export in a `use server` file must be async" rule.
- **Decision — Two permanent invariants**:
  1. **`"use server"` files may only export `async` functions and `type` re-exports.** Pure sync utility functions, constants, and class instances must live in plain lib modules (e.g. `src/lib/date.ts`, `src/lib/marginalia.ts`, `src/lib/schedules.ts`). They can be imported and used internally by `"use server"` files but never exported from them — not even via `export { fn } from "..."` re-exports.
  2. **The mandatory verification command before any commit that touches `src/` is `bun test && bun x tsc --noEmit && bun next build`.** `bun test` alone is not sufficient. `tsc --noEmit` alone is not sufficient. All three must pass.
- **Consequences**: Zero silent build regressions. Clear module boundary: `src/lib/actions/*.ts` = async Server Actions only; `src/lib/*.ts` = pure sync business logic, shared utilities, and types.
