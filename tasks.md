# Tasks: Titirek Modern UI Overhaul

- [x] **Phase 1: Foundations & Design System**
  - [x] 1.1 Update `src/app/layout.tsx`: Remove `maximumScale: 1` viewport restriction, optimize font classes.
  - [x] 1.2 Refine `src/app/globals.css`: Enhance OKLCH color palettes, card elevations, border subtle classes, badge colors, and micro-transition utilities.
  - [x] 1.3 Create `src/components/theme-toggle.tsx`: Modern light/dark mode switch button with smooth icon transitions.
  - [x] 1.4 Create `src/components/media-badge.tsx`: Standardized media badge component with icons (BookOpen, Film, Tv, Music, Podcast) and subtle tint styling.

- [x] **Phase 2: Responsive App Shell & Navigation**
  - [x] 2.1 Create `src/components/layout/app-shell.tsx`: Shared responsive shell featuring desktop sidebar/header and mobile top/bottom navigation.
  - [x] 2.2 Create `src/components/layout/desktop-sidebar.tsx`: Desktop navigation sidebar with group switcher, nav links (Groups, Activity, Profile, Admin), and user info.
  - [x] 2.3 Update `src/components/bottom-nav.tsx`: Modernize mobile bottom navigation with sleek active tab indicators and haptic-like feel.

- [x] **Phase 3: Interactive Component Modernization**
  - [x] 3.1 Upgrade `src/components/media-cover.tsx`: Add aspect ratio container, improved fallback placeholder, and smooth image loading.
  - [x] 3.2 Upgrade `src/components/vote-control.tsx`: Enhance hit-targets (44px min touch target), distinct active state styling (teal/emerald up, rose/amber down), and clean optimistic animations.
  - [x] 3.3 Modernize `src/components/review-form.tsx`: Polished star rating interaction, elegant textarea, and review cards display.
  - [x] 3.4 Modernize `src/components/confirm-action-button.tsx`: Sleek dialog styling for destructive and critical operations.

- [x] **Phase 4: Page-by-Page Overhaul**
  - [x] 4.1 Groups Dashboard (`src/app/groups/page.tsx`): Responsive multi-column grid, modern group cards with progress/stats, and streamlined Create/Join dialogs.
  - [x] 4.2 Group Detail View (`src/app/groups/[groupId]/page.tsx`): Hero header with copyable invite code, member avatars, responsive split/tabbed layout (Up Next backlog vs Consumed archive), media filtering, and empty states.
  - [x] 4.3 Add Media View (`src/app/groups/[groupId]/add/page.tsx` & `add-title-form.tsx`): Modern category filter pills, fast search bar, responsive media preview cards, and one-tap proposal buttons.
  - [x] 4.4 Group Settings (`src/app/groups/[groupId]/settings/page.tsx` & forms): Organized settings sections (Details, Invite, Members Roster, Danger Zone).
  - [x] 4.5 Activity Feed (`src/app/activity/page.tsx`): Timeline-grouped feed with rich activity cards and direct group links.
  - [x] 4.6 Profile & Auth (`src/app/profile/page.tsx`, `src/app/login/page.tsx`, `src/app/reset-password/page.tsx`): Beautiful card layout, unified OAuth buttons, passwordless OTP, and account settings.
  - [x] 4.7 Admin Portal (`src/app/admin/**`): Convert raw Tailwind colors to design system tokens, responsive dashboard cards, and polished user/group management tables.

- [x] **Phase 5: Verification & Polish**
  - [x] 5.1 Run `bun run typecheck` to ensure full TypeScript type correctness.
  - [x] 5.2 Run `bun run build` to verify Next.js production build bundle.
  - [x] 5.3 Test responsive breakpoints across mobile and desktop widths.
