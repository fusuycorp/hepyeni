# Tasks: Security Hardening, Automated Testing, and Documentation

- [x] **Phase 1: Security & Concurrency Remediations**
  - [x] 1.1 Update `pb_migrations/1755280800_initial_schema.js` to enable passwordAuth (`users.passwordAuth.enabled = true`).
  - [x] 1.2 Fix authentication error codes in `src/lib/actions/auth.ts` and `src/app/login/page.tsx` (`InvalidCode`, `InvalidCredentials`, `InvalidPassword`, `EmailInUse`, `AccessDenied`).
  - [x] 1.3 Fix race condition in `src/lib/actions/votes.ts` by catching `isNotFound` during concurrent vote toggle/delete operations.
  - [x] 1.4 Prevent orphaned ownerless circles in `src/lib/actions/groups.ts:leaveGroup`.
  - [x] 1.5 Enforce input length boundaries in `src/lib/actions/reviews.ts`, `profile.ts`, `auth.ts`, and `titles.ts`.
  - [x] 1.6 Add `AbortSignal.timeout(8000)` to all fetch calls in `src/lib/providers/` (Google Books, TMDB, Spotify, iTunes).
  - [x] 1.7 Add runtime type and URL protocol guards in `src/lib/actions/titles.ts` and `admin.ts`.

- [x] **Phase 2: Automated Test Suite**
  - [x] 2.1 Add `tests/vote-id.test.ts` (deterministic hashing, length, uniqueness).
  - [x] 2.2 Add `tests/invite-code.test.ts` (charset, length, randomness).
  - [x] 2.3 Add `tests/media-types.test.ts` (types, labels, runtime guard).
  - [x] 2.4 Add `tests/membership.test.ts` (mocked IDOR authorization guards).
  - [x] 2.5 Add `tests/providers.test.ts` (provider normalization, resilience, timeouts).
  - [x] 2.6 Add `"test": "bun test"` script to `package.json`.

- [x] **Phase 3: Documentation & Decision Tracking**
  - [x] 3.1 Create `DECISIONS.md` recording ADRs (Responsive Shell, Deterministic Hash, Security Hardening, Provider Architecture).
  - [x] 3.2 Update `README.md` with complete documentation, environment setup, testing guide, and deployment instructions.
  - [x] 3.3 Update `AGENT_LOG.md` with recent overhaul and security milestones.

- [x] **Phase 4: Verification & Push**
  - [x] 4.1 Run `bun test` to ensure all tests pass.
  - [x] 4.2 Run `bun run typecheck` (`tsc --noEmit`).
  - [x] 4.3 Run `bun run lint` (`eslint`).
  - [x] 4.4 Run `bun run build` (`next build`).
  - [x] 4.5 Stage explicitly and git push to `main`.
