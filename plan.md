# Implementation Plan: Language Toggle Fix, Floating Action Button Fix & Media Comments Feature

## Objectives
1. **Fix Language Change Feature**:
   - Resolve cookie name mismatch (`locale` vs `NEXT_LOCALE`) between `src/components/language-toggle.tsx`, `src/lib/i18n/server.ts`, and `src/lib/i18n/client.tsx`.
   - Add missing `metadata` fields to `types.ts`, `tr.ts`, `en.ts`.
   - Connect `LanguageToggle` directly to `useI18n()` context and ensure immediate reactivity on both client and server components via `router.refresh()`.
   - Complete localized translations across navigation, sidebar, groups, activity, profile, and admin pages.

2. **Fix Right-Bottom "Medya Öner" Floating Action Button**:
   - Resolve Base UI `<DialogTrigger>` prop forwarding bug in `src/components/add-title-dialog.tsx` caused by wrapping the trigger element in a `<React.Fragment>`.
   - Fix to `render={trigger as React.ReactElement}`.

3. **Design & Implement Media Comments Feature**:
   - Allow circle members to comment, discuss, and talk about any recommended media (both proposed and consumed).
   - Add PocketBase collection migration `pb_migrations/1755280900_comments_schema.js`.
   - Update `src/types/pocketbase-types.ts` with `CommentsRecord` & `CommentsResponse`.
   - Implement secure server actions in `src/lib/actions/comments.ts` (`addComment`, `deleteComment`) with membership verification and input boundaries.
   - Build UI component `src/components/media-comments.tsx` with dialog/collapsible thread, relative timestamping, and deletion controls.
   - Integrate comments into `group-content-view.tsx` and `activity/page.tsx`.
   - Add localization strings in `tr.ts` and `en.ts`.
   - Add automated test suite `tests/comments.test.ts`.

---

## Technical Specifications & Architecture

### 1. Database Schema (`comments`)
- **Collection**: `comments`
- **Fields**:
  - `id`: 15-char string (PK)
  - `title`: Relation -> `titles.id` (`cascadeDelete: true`)
  - `user`: Relation -> `users.id` (`cascadeDelete: true`)
  - `group`: Relation -> `groups.id` (`cascadeDelete: true`)
  - `content`: Text (Required, max 2000 chars)
  - `createdAt`: Autodate (`onCreate: true`)
  - `updatedAt`: Autodate (`onCreate: true`, `onUpdate: true`)
- **Indexes**: `idx_comments_title_created` on `(title, createdAt)`

### 2. Permissions & Authorization
- Only members of the circle (`group_members`) can view or post comments on titles in that group.
- Comment deletion is permitted only by the comment author, circle owner, or platform admin.
- API rules set to `null` on PocketBase, handled entirely through Next.js server actions using `getSuperuserClient()`.

---

## Execution Phases
- **Phase 1**: Fix Language Toggle and Base UI Dialog Trigger bug.
- **Phase 2**: Add Database Migration & PocketBase Types for Comments.
- **Phase 3**: Create Server Actions & Automated Tests for Comments.
- **Phase 4**: Build Media Comments UI & Integrate with Group View & Activity Feed.
- **Phase 5**: Complete Full i18n Localization for Comments and UI.
- **Phase 6**: Verification (`bun test`, `bun run typecheck`, `bun run lint`).
