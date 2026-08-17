# Implementation Plan: Turkish Language Support & Third-Party Integration Guide

## Objectives
1. **Production Deployment (`hepyeni.net`)**:
   - Canonical Domain: `https://hepyeni.net`
   - Google OAuth2 Authorized Origin: `https://hepyeni.net`
   - Google OAuth2 Callback URI: `https://hepyeni.net/api/auth/oauth2-callback`
   - Public Privacy Policy URL: `https://hepyeni.net/privacy`
   - Public Terms of Service URL: `https://hepyeni.net/terms`
   - Production Environment Variable: `APP_URL=https://hepyeni.net`

2. **Privacy Policy & Terms of Service (Legal & OAuth Compliance)**:
   - Make `/privacy` and `/terms` public in `src/proxy.ts` (bypass login redirects).
   - Create `src/app/privacy/page.tsx` covering:
     - Data collection (Name, email, avatar from Google/Apple OAuth or email registration).
     - Purpose of data processing (Authentication, circle collaboration, media recommendations).
     - Third-party integrations (Google OAuth, Apple Sign-In, TMDB API, Spotify API, iTunes Podcasts, Google Books).
     - Data retention & account deletion (Self-service permanent deletion in `/profile`).
     - Cookie policy (HttpOnly session cookies `pb_session`, PKCE state `pb_oauth_state`).
     - Contact details for `hepyeni.net`.
   - Create `src/app/terms/page.tsx` covering:
     - User accounts & security responsibilities.
     - Acceptable use & group moderation rules.
     - Media metadata intellectual property disclaimer (TMDB, Spotify, Google Books).
     - Limitation of liability & account termination.
   - Add footer links to `/privacy` and `/terms` across `src/app/login/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/profile/page.tsx`, and sidebar.

3. **Turkish Language Support (i18n)**:
   - Provide complete, native Turkish translation and localization across all pages, components, toasts, badges, and relative date formatters.
   - Zero-dependency, type-safe dictionary system (`src/lib/i18n/`).
   - Maintain full test coverage and type-safety (`bun test`, `tsc --noEmit`, `bun run lint`).

---

## 1. i18n Architecture Design

### Directory Structure:
- `src/lib/i18n/types.ts`: TypeScript interface definitions for the entire dictionary structure.
- `src/lib/i18n/tr.ts`: Full Turkish dictionary.
- `src/lib/i18n/en.ts`: English dictionary (for fallback/reference).
- `src/lib/i18n/index.ts`: Dictionary resolver, helper utilities, and relative time formatter (`tr-TR`).

### Localization Touchpoints:
1. **HTML & Metadata**: `src/app/layout.tsx` (`lang="tr"`, metadata title & description in Turkish).
2. **Navigation & Layout**:
   - `src/components/layout/desktop-sidebar.tsx`
   - `src/components/bottom-nav.tsx`
   - `src/components/layout/app-shell.tsx`
   - `src/components/theme-toggle.tsx`
3. **Auth & Profile**:
   - `src/app/login/page.tsx`
   - `src/app/reset-password/page.tsx`
   - `src/app/profile/page.tsx`
   - `src/components/forgot-password-form.tsx`
   - `src/components/send-reset-link-button.tsx`
   - `src/components/update-name-form.tsx`
4. **Groups / Circles & Media**:
   - `src/app/groups/page.tsx`
   - `src/app/groups/[groupId]/page.tsx`
   - `src/app/groups/[groupId]/group-content-view.tsx`
   - `src/app/groups/[groupId]/add/page.tsx`
   - `src/app/groups/[groupId]/add/add-title-form.tsx`
   - `src/app/groups/[groupId]/settings/page.tsx`
   - `src/components/group-forms.tsx`
   - `src/components/review-form.tsx`
   - `src/components/vote-control.tsx`
   - `src/components/confirm-action-button.tsx`
   - `src/components/copy-invite-button.tsx`
   - `src/components/empty-state.tsx`
   - `src/components/mark-consumed-button.tsx`
   - `src/components/media-badge.tsx`
5. **Activity & Admin**:
   - `src/app/activity/page.tsx` (Localized relative time: "şimdi", "5 dk önce", "2 saat önce", "3 gün önce")
   - `src/app/admin/layout.tsx`
   - `src/app/admin/page.tsx`
   - `src/app/admin/users/page.tsx`
   - `src/app/admin/groups/page.tsx`
   - `src/app/admin/groups/[groupId]/page.tsx`
6. **Server Actions Messages**:
   - `src/lib/actions/auth.ts`, `groups.ts`, `titles.ts`, `reviews.ts`, `votes.ts`, `profile.ts`, `admin.ts`.

---

## 2. Execution Phases

- [ ] **Phase 1**: Create `src/lib/i18n/types.ts`, `tr.ts`, `en.ts`, and `index.ts`.
- [ ] **Phase 2**: Localize Navigation, Layout, Theme Toggle, AppShell, and Metadata.
- [ ] **Phase 3**: Localize Auth (Login, Reset Password, Profile) & Action Responses.
- [ ] **Phase 4**: Localize Groups / Circles, Media Search, Add Title, Reviews, Voting, and Settings.
- [ ] **Phase 5**: Localize Activity Timeline (with `tr-TR` relative time) and Admin Portal.
- [ ] **Phase 6**: Run `bun run typecheck`, `bun run lint`, and `bun test` to verify zero errors or regressions.
