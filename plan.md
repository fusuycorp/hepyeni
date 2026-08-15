# Plan: Security Hardening, Comprehensive Testing, and Documentation Sync

## 1. Objectives
- **Security & Integrity**: Remediate all high- and medium-severity security and concurrency findings identified in the audit:
  - Fix authentication error mapping to prevent confusing legitimate users with suspended accounts (`H-02`).
  - Align schema passwordAuth with application authentication actions (`H-01`).
  - Resolve concurrency race condition in atomic vote toggling (`H-03`).
  - Prevent orphaned groups on sole member exit (`M-02`).
  - Enforce server-side length and size limits on unbounded inputs (`M-03`).
  - Introduce timeout abort signals (`AbortSignal.timeout(8000)`) on all external provider fetch requests (`M-04`).
  - Runtime guards for media types and protocol validation for image URLs (`L-03`, `L-04`).
- **Comprehensive Automated Testing**:
  - Implement full test suite using Bun's native test runner (`bun test`).
  - Cover deterministic vote ID hashing, invite code generator, media types, access control/IDOR helpers, and external providers.
- **Documentation & Decision Tracking**:
  - Create and maintain `DECISIONS.md` according to `AGENTS.md` Section 8.
  - Update `README.md` to reflect architecture, responsive UI features, environment configurations, testing instructions, and deployment workflow.
  - Update `AGENT_LOG.md`.

---

## 2. Phased Architecture & Execution Plan

### Phase 1: Security & Concurrency Remediations
1. **Authentication Error Mapping (`src/lib/actions/auth.ts`, `src/app/login/page.tsx`)**:
   - Separate distinct error codes: `InvalidCode`, `InvalidCredentials`, `InvalidPassword`, `EmailInUse`, `AccessDenied`.
   - Enable `users.passwordAuth.enabled = true;` in `pb_migrations/1755280800_initial_schema.js` to ensure password flows succeed against PocketBase schema.
2. **Vote Concurrency Resilience (`src/lib/actions/votes.ts`)**:
   - Wrap record fetch/toggle in `isNotFound(toggleErr)` catch to gracefully handle concurrent delete/create races without throwing uncaught 404s.
3. **Group Lifecycle & Orphan Prevention (`src/lib/actions/groups.ts`)**:
   - In `leaveGroup`, automatically delete the group when the last remaining member leaves.
4. **Input Validation & Bound Checking**:
   - `src/lib/actions/reviews.ts`: Limit `reviewText` to 5000 chars.
   - `src/lib/actions/profile.ts`: Limit `name` to 200 chars.
   - `src/lib/actions/auth.ts`: Limit `password` to 128 chars.
   - `src/lib/actions/titles.ts`: Guard `MEDIA_TYPES.includes(mediaType)`, validate `coverUrl` begins with `https?://`, and bound metadata size.
5. **Provider Reliability & Timeouts (`src/lib/providers/`)**:
   - Add `signal: AbortSignal.timeout(8000)` to all fetch requests in Google Books, TMDB, Spotify, and iTunes.

### Phase 2: Comprehensive Test Suite
1. Create `tests/vote-id.test.ts`: Test deterministic hash generation, idempotency, distinct user/title hashing, and charset validity.
2. Create `tests/invite-code.test.ts`: Test 8-character output, character set constraints (no ambiguous chars), and uniqueness distribution.
3. Create `tests/media-types.test.ts`: Test supported media types, labels mapping, and validation guards.
4. Create `tests/membership.test.ts`: Test membership validation, ownership checks, and IDOR protection.
5. Create `tests/providers.test.ts`: Test normalization logic, error resilience, empty queries, and timeout handling.
6. Configure `package.json` with `"test": "bun test"`.

### Phase 3: Documentation & Decision Tracking
1. Create `DECISIONS.md`: Record architectural decisions (Responsive AppShell, Deterministic Vote Hash, Provider Architecture, Security Hardening).
2. Update `README.md`: Complete overview, tech stack, quickstart, environment variables, test instructions, and deployment guide.
3. Update `AGENT_LOG.md`: Session milestone log.

### Phase 4: Verification Pipeline & Git Push
1. Run `bun test` — ensure 100% tests pass.
2. Run `bun run typecheck` (`tsc --noEmit`) — ensure 0 type errors.
3. Run `bun run lint` (`eslint`) — ensure 0 lint errors.
4. Run `bun run build` (`next build`) — ensure production bundle succeeds.
5. Explicitly stage files and push with conventional commit.
