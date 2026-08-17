# Architectural Decision Records (ADRs)

This document records the major architectural pivots, design decisions, and security strategies for the **Titirek** codebase, adhering to the operating principles defined in `AGENTS.md`.

---

## ADR-001: Responsive App Shell & Multi-Breakpoint Layout Strategy
- **Status**: Accepted & Implemented (2026-08-15)
- **Context**: The original frontend constrained all pages inside a `max-w-md` container, preventing effective usage of widescreen desktop displays. Navigation was manually declared per page via a bottom bar.
- **Decision**:
  - Implemented a unified `AppShell` with responsive layout boundaries.
  - On desktop (`≥768px`), a persistent `DesktopSidebar` renders with group shortcuts, navigation links, user profile details, and theme toggling.
  - On mobile (`<768px`), a fixed `BottomNav` with haptic-inspired active pill indicators and safe-area insets renders.
  - Group views utilize a 3-column responsive split (2 cols for backlog/consumed items with media type filtering; 1 col for circle details and member roster).
- **Consequences**: Consistent navigation UX across all screen sizes, elimination of per-page layout boilerplate, and full compliance with WCAG accessibility standards (enabling user pinch-to-zoom).

---

## ADR-002: Deterministic SHA-256 Hashing for Atomic Vote Toggling
- **Status**: Accepted & Implemented (2026-08-15)
- **Context**: In SQLite-backed PocketBase, concurrent vote requests from the same user on the same title can create duplicate vote rows or state race conditions without distributed transaction locks.
- **Decision**:
  - Compute a deterministic 15-character base36 hash of `titleId:userId` as the PocketBase record `id` (`voteRecordId`).
  - Under SQLite's single-writer model, concurrent creations serialize: the first succeeds, and any concurrent duplicate triggers a 400 unique constraint catch, converting the action into an atomic toggle/flip update.
  - In `voteOnTitle`, handle `isNotFound` exceptions in the toggle branch to ensure concurrent delete/create operations never bubble up uncaught 404s.
- **Consequences**: 100% race-resilient voting without requiring distributed locks or heavyweight database transactions.

---

## ADR-003: Zero Client-Side PocketBase Access & Strict Multi-Tenant IDOR Defense
- **Status**: Accepted & Implemented (2026-08-15)
- **Context**: Direct client SDK access to database records risks leaking multi-tenant data if API rules are loosely configured.
- **Decision**:
  - All PocketBase collections have `null` API rules (superuser only).
  - All queries and mutations are executed server-side via Next.js Server Actions using `getSuperuserClient()`.
  - Every server action enforces multi-tenant defense in depth:
    1. Validates the caller's active session (`getSession()`).
    2. Validates caller membership in the target circle (`requireMembership(groupId, userId)`).
    3. Validates that the target title/review strictly belongs to the specified circle (`requireTitleInGroup(titleId, groupId)`).
    4. Validates caller ownership for administrative operations (`requireOwner(groupId, userId)`).
- **Consequences**: Complete protection against IDOR (Insecure Direct Object References) and cross-tenant data leakage.

---

## ADR-004: External Provider Adapter Pattern & Resilience
- **Status**: Accepted & Implemented (2026-08-15)
- **Context**: Titirek integrates with multiple disparate media APIs (Google Books, TMDB, Spotify, iTunes Podcasts) with differing authentication flows, query formats, and payload structures.
- **Decision**:
  - Standardized all external providers under the `MediaProvider` interface (`search(query): Promise<NormalizedSearchResult[]>`).
  - Wrapped all external API calls in `AbortSignal.timeout(8000)` to prevent hanging requests from exhausting connection pools.
  - Standardized cover art rendering via `<MediaCover />` with `aspect-[2/3]` containers and generic fallback icons, bypassing Next.js remote allowlist constraints for varied third-party image domains.
- **Consequences**: Pluggable provider architecture with predictable timeout behavior and zero layout shift (CLS).

---

## ADR-005: Single Merged Deploy Workflow with Explicit Build-Before-Redeploy Ordering
- **Status**: Accepted & Implemented (2026-08-17)
- **Context**: `deploy.yml` (app image build/push + Dokploy redeploy trigger) and `deploy-pocketbase.yml` (PocketBase image build/push) were separate workflows, both triggered independently on push to `main`. A commit touching only `pb_migrations/**` could fire `deploy.yml`'s redeploy before `deploy-pocketbase.yml`'s image push finished, leaving the running `pocketbase` service on stale migrations — masked in practice only by the app image's slower build time, never actually enforced.
- **Decision**:
  - Merged into a single `deploy.yml` with four jobs: `changes` (diffs the pushed commit range to detect `pb_migrations/**`/`Dockerfile.pocketbase` changes) → `build-app` (always runs) + `build-pocketbase` (conditional on the `changes` output) → `deploy` (`needs: [build-app, build-pocketbase]`, explicitly tolerating a skipped `build-pocketbase` but not a failed one).
  - Deleted the standalone `deploy-pocketbase.yml`.
- **Consequences**: Redeploy ordering is now enforced by GitHub Actions' `needs` dependency graph instead of being incidental to build-time differences between the two images. Tradeoff accepted: the old workflow's ability to manually `workflow_dispatch` a PocketBase-image-only rebuild (without also rebuilding the app image and triggering a redeploy) was lost — not worth a separate dispatch-input mechanism unless it's actually needed later.
