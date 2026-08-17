# Tasks: Language Fix, FAB Fix, and Media Comments Feature

- [x] **Phase 1: Bug Fixes (Language Toggle & FAB Trigger)**
  - [x] 1.1 Fix `src/components/add-title-dialog.tsx` Base UI trigger `render` prop forwarding.
  - [x] 1.2 Fix `src/lib/i18n/server.ts`, `client.tsx`, and `language-toggle.tsx` cookie handling (`NEXT_LOCALE` / `locale`) and synchronization.
  - [x] 1.3 Add `metadata` property to `src/lib/i18n/types.ts`, `tr.ts`, and `en.ts`.

- [x] **Phase 2: Database Migration & Schema Types for Comments**
  - [x] 2.1 Create PocketBase migration `pb_migrations/1755280900_comments_schema.js` with cascade deletion and indexing.
  - [x] 2.2 Add `CommentsRecord` and `CommentsResponse` to `src/types/pocketbase-types.ts`.

- [x] **Phase 3: Server Actions & Automated Testing**
  - [x] 3.1 Implement `addComment` and `deleteComment` in `src/lib/actions/comments.ts` with strict input validation and membership authorization.
  - [x] 3.2 Write automated unit/integration tests in `tests/comments.test.ts`.

- [x] **Phase 4: Media Comments UI & Integration**
  - [x] 4.1 Create `src/components/media-comments.tsx` with dialog/thread, avatar, relative timestamping, and delete actions.
  - [x] 4.2 Integrate comments button and dialog in `src/app/groups/[groupId]/group-content-view.tsx` and `page.tsx`.
  - [x] 4.3 Update `src/app/activity/page.tsx` to include comment events in the activity stream.

- [x] **Phase 5: Localization (i18n) Completion**
  - [x] 5.1 Add comments dictionary section to `types.ts`, `tr.ts`, and `en.ts`.
  - [x] 5.2 Integrate `useTranslations` / `getServerTranslations` across UI components (sidebar, bottom-nav, app-shell, dialogs, forms).

- [x] **Phase 6: Verification & QA**
  - [x] 6.1 Run `bun test` to verify all test suites pass (28/28 tests passing).
  - [x] 6.2 Run `bun run typecheck` (`tsc --noEmit`) to verify zero type errors.
  - [x] 6.3 Run `bun run lint` to ensure clean code style.
  - [x] 6.4 Run `bun run build` (`next build`) to verify optimized production build succeeds.
