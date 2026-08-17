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

## Operational Gotcha: GitHub OAuth token lacks `workflow` scope by default
- The `gh`-issued token used for `git push` in this environment only carries `repo` scope by default, which GitHub rejects for any push that modifies `.github/workflows/*` ("refusing to allow an OAuth App to create or update workflow ... without `workflow` scope"). This has caused a workflow file to be silently left uncommitted/unpushed before (see git history around the PocketBase deploy workflow).
- **Fix**: `gh auth refresh --hostname github.com --scopes repo,workflow` (must include `--hostname` when run non-interactively; opens a device-code browser flow the user has to approve). Check `gh auth status` first — if `workflow` is already listed, no action needed.


