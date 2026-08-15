# Tasks: Security Hardening, Automated Testing, and Documentation

- [ ] **Phase 1: Security & Concurrency Remediations**
  - [ ] 1.1 Update `pb_migrations/1755280800_initial_schema.js` to enable passwordAuth (`users.passwordAuth.enabled = true`).
  - [ ] 1.2 Fix authentication error codes in `src/lib/actions/auth.ts` and `src/app/login/page.tsx` (`InvalidCode`, `InvalidCredentials`, `InvalidPassword`, `EmailInUse`, `AccessDenied`).
  - [ ] 1.3 Fix race condition in `src/lib/actions/votes.ts` by catching `isNotFound` during concurrent vote toggle/delete operations.
  - [ ] 1.4 Prevent orphaned ownerless circles in `src/lib/actions/groups.ts:leaveGroup`.
  - [ ] 1.5 Enforce input length boundaries in `src/lib/actions/reviews.ts`, `profile.ts`, `auth.ts`, and `titles.ts`.
  - [ ] 1.6 Add `AbortSignal.timeout(8000)` to all fetch calls in `src/lib/providers/` (Google Books, TMDB, Spotify, iTunes).
  - [ ] 1.7 Add runtime type and URL protocol guards in `src/lib/actions/titles.ts` and `admin.ts`.

- [ ] **Phase 2: Automated Test Suite**
  - [ ] 2.1 Add `tests/vote-id.test.ts` (deterministic hashing, length, uniqueness).
  - [ ] 2.2 Add `tests/invite-code.test.ts` (charset, length, randomness).
  - [ ] 2.3 Add `tests/media-types.test.ts` (types, labels, runtime guard).
  - [ ] 2.4 Add `tests/membership.test.ts` (mocked IDOR authorization guards).
  - [ ] 2.5 Add `tests/providers.test.ts` (provider normalization, resilience, timeouts).
  - [ ] 2.6 Add `"test": "bun test"` script to `package.json`.

- [ ] **Phase 3: Documentation & Decision Tracking**
  - [ ] 3.1 Create `DECISIONS.md` recording ADRs (Responsive Shell, Deterministic Hash, Security Hardening, Provider Architecture).
  - [ ] 3.2 Update `README.md` with complete documentation, environment setup, testing guide, and deployment instructions.
  - [ ] 3.3 Update `AGENT_LOG.md` with recent overhaul and security milestones.

- [ ] **Phase 4: Verification & Push**
  - [ ] 4.1 Run `bun test` to ensure all tests pass.
  - [ ] 4.2 Run `bun run typecheck` (`tsc --noEmit`).
  - [ ] 4.3 Run `bun run lint` (`eslint`).
  - [ ] 4.4 Run `bun run build` (`next build`).
  - [ ] 4.5 Stage explicitly and git push to `main`.
