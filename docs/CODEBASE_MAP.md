# HepYeni Codebase Map

This document provides a detailed directory tree breakdown and file-by-file reference for the entire **HepYeni** codebase.

---

## 1. Directory Tree Overview

```
hepyeni/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions CI/CD deployment workflow
├── docs/                           # Architecture, security, and developer documentation
│   ├── ARCHITECTURE.md
│   ├── AUTH_AND_SECURITY.md
│   ├── CODEBASE_MAP.md
│   ├── DATA_MODELS.md
│   ├── DEPLOYMENT_AND_INFRA.md
│   ├── EXTERNAL_APIS.md
│   └── README.md
├── pb_migrations/                  # PocketBase schema migration scripts
│   └── 1755280800_initial_schema.js
├── public/                         # Static web assets
├── src/
│   ├── app/                        # Next.js App Router pages and route handlers
│   │   ├── activity/
│   │   ├── admin/
│   │   ├── api/
│   │   ├── groups/
│   │   ├── login/
│   │   ├── privacy/
│   │   ├── profile/
│   │   ├── reset-password/
│   │   ├── terms/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/                 # React UI components and layouts
│   │   ├── layout/
│   │   ├── ui/
│   │   └── ... (Domain components)
│   ├── lib/                        # Business logic, actions, providers, utilities
│   │   ├── actions/
│   │   ├── i18n/
│   │   ├── pocketbase/
│   │   ├── providers/
│   │   ├── admin.ts
│   │   ├── invite-code.ts
│   │   ├── media-types.ts
│   │   ├── membership.ts
│   │   └── utils.ts
│   ├── proxy.ts                    # Edge routing middleware and auth gate
│   └── types/                      # TypeScript definitions and PocketBase types
│       └── pocketbase-types.ts
├── tests/                          # Bun test runner automated test suites
├── Dockerfile                      # Next.js standalone runner container build
├── Dockerfile.pocketbase           # PocketBase migration-baked container build
├── docker-compose.yml              # Local container execution definition
├── package.json                    # Dependencies and npm scripts
└── tsconfig.json                   # TypeScript compiler configuration
```

---

## 2. Root Configuration & Build Files

| File | Purpose |
|---|---|
| [`package.json`](file:///home/devhax/projects/fusuycorp/hepyeni/package.json) | Declares package dependencies (Next.js 16.3, React 19, PocketBase 0.27, Tailwind CSS v4, Base UI, Lucide icons, Sonner) and scripts (`dev`, `build`, `typecheck`, `lint`, `test`). |
| [`Dockerfile`](file:///home/devhax/projects/fusuycorp/hepyeni/Dockerfile) | Multi-stage Bun build producing a minimal standalone Next.js production container running on port 3000 under a non-root `nextjs` user. |
| [`Dockerfile.pocketbase`](file:///home/devhax/projects/fusuycorp/hepyeni/Dockerfile.pocketbase) | Builds on `ghcr.io/muchobien/pocketbase:0.39.11` and copies local `pb_migrations/` to `/pb_migrations` for automated bootstrap on startup. |
| [`docker-compose.yml`](file:///home/devhax/projects/fusuycorp/hepyeni/docker-compose.yml) | Local multi-service runner configuration connecting the HepYeni frontend container to local PocketBase. |
| [`tsconfig.json`](file:///home/devhax/projects/fusuycorp/hepyeni/tsconfig.json) | Strict TypeScript compiler options with `@/*` path aliases resolving to `./src/*`. |
| [`next.config.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/next.config.ts) | Next.js configuration enabling standalone output build mode (`output: "standalone"`). |
| [`components.json`](file:///home/devhax/projects/fusuycorp/hepyeni/components.json) | Configuration for UI component generation and styling tokens. |
| [`eslint.config.mjs`](file:///home/devhax/projects/fusuycorp/hepyeni/eslint.config.mjs) | ESLint configuration utilizing Next.js Core Web Vitals rules. |
| [`DECISIONS.md`](file:///home/devhax/projects/fusuycorp/hepyeni/DECISIONS.md) | Architectural Decision Records (ADR-001 through ADR-004) covering UI shells, voting hashing, IDOR defense, and external adapters. |

---

## 3. Edge Routing Gate: `src/proxy.ts`

- [`src/proxy.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/proxy.ts): Next.js middleware evaluating incoming requests before rendering. Extracts the `pb_session` cookie, verifies freshness against PocketBase via [`getSessionFromToken`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/pocketbase/session.ts#L21), redirects unauthenticated requests to `/login`, and prevents non-admin users from accessing `/admin/*`.

---

## 4. Core Libraries & Actions: `src/lib/`

### 4.1 Server Actions (`src/lib/actions/`)
All backend mutations are isolated into dedicated server action modules:

- [`src/lib/actions/auth.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/actions/auth.ts):
  - `signInWithGoogle()` / `signInWithApple()`: Initiates server-side OAuth2 code flow and stores PKCE `codeVerifier` in transient cookie.
  - `signInWithEmail(formData)`: Looks up or creates user record, calls `requestOTP`, and sets temporary `pb_otp` cookie.
  - `verifyEmailCode(formData)`: Verifies OTP code with PocketBase, rejects banned users, sets session cookie.
  - `signInWithPassword(formData)`: Standard password authentication.
  - `signUpWithPassword(formData)`: Creates new account via superuser client and establishes session.
  - `requestPasswordReset(formData)`: Dispatches password reset email.
  - `confirmPasswordReset(formData)`: Confirms token and updates user password.
  - `signOutAction()`: Clears `pb_session` cookie and redirects to `/login`.
- [`src/lib/actions/groups.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/actions/groups.ts):
  - `createGroup(formData)`: Generates 8-char invite code, creates group, sets caller as `owner`.
  - `joinGroup(formData)`: Resolves invite code and creates `group_members` record with role `member`.
  - `renameGroup(groupId, formData)`: Updates circle name (guarded by `requireOwner`).
  - `regenerateInviteCode(groupId)`: Replaces invite code (guarded by `requireOwner`).
  - `removeMember(groupId, memberId)`: Removes specific member (guarded by `requireOwner`).
  - `leaveGroup(groupId)`: Member voluntarily leaves circle; if sole owner leaves, circle is deleted.
  - `deleteGroup(groupId)`: Deletes circle and cascades delete to all members, titles, votes, and reviews.
- [`src/lib/actions/titles.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/actions/titles.ts):
  - `searchTitles(mediaType, query)`: Dispatches search query to external media provider.
  - `addTitle(groupId, mediaType, result)`: Adds title to circle backlog (bounded inputs, idempotent).
  - `markConsumed(titleId, groupId)`: Sets title `status: 'consumed'` and records `consumedAt`.
- [`src/lib/actions/votes.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/actions/votes.ts):
  - `voteOnTitle(titleId, groupId, value)`: Executes concurrency-resilient vote creation, toggle-off, or flip via deterministic SHA-256 ID hashing.
- [`src/lib/actions/reviews.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/actions/reviews.ts):
  - `submitReview(titleId, groupId, formData)`: Upserts a 1–5 star rating and optional text review (max 5,000 chars).
- [`src/lib/actions/profile.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/actions/profile.ts):
  - `updateProfileName(formData)`: Updates user display name (max 200 chars).
  - `deleteAccount()`: Deletes user record (safely blocked by PocketBase if user owns active groups or titles).
- [`src/lib/actions/admin.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/actions/admin.ts):
  - `setUserAdmin(userId, isAdmin)`: Promotes/demotes admin privileges.
  - `banUser(userId)` / `unbanUser(userId)`: Sets/clears `bannedAt` timestamp.
  - `adminDeleteGroup(groupId)`: Administrative deletion of any circle.
  - `adminDeleteTitle(titleId, groupId)`: Administrative deletion of any title.
  - `adminDeleteReview(reviewId, groupId)`: Administrative deletion of any review.
  - `adminRemoveGroupMember(groupId, userId)`: Administrative member removal.

### 4.2 PocketBase Infrastructure (`src/lib/pocketbase/`)
- [`src/lib/pocketbase/superuser.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/pocketbase/superuser.ts): Singleton superuser client with request auto-cancellation disabled and concurrent auth mutex locking.
- [`src/lib/pocketbase/session.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/pocketbase/session.ts): Session verification via live `authRefresh()`, cookie management (`pb_session`, `pb_oauth_state`, `pb_otp`), and OAuth redirect URL builder.
- [`src/lib/pocketbase/vote-id.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/pocketbase/vote-id.ts): Computes a deterministic 15-character base36 hash of `titleId:userId` for atomic vote records.
- [`src/lib/pocketbase/errors.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/pocketbase/errors.ts): Type helpers for PocketBase error inspection (`isValidationNotUnique`, `isNotFound`).

### 4.3 External Media Providers (`src/lib/providers/`)
- [`src/lib/providers/types.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/types.ts): Defines `MediaProvider` interface and `NormalizedSearchResult` shape.
- [`src/lib/providers/index.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/index.ts): Registry mapping `book`, `movie`, `tv`, `music`, `podcast` to provider implementations.
- [`src/lib/providers/google-books.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/google-books.ts): Google Books search adapter with SSL image URL promotion.
- [`src/lib/providers/tmdb.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/tmdb.ts): The Movie Database (TMDB) adapter for movies and TV shows using v4 Bearer token authorization.
- [`src/lib/providers/spotify.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/spotify.ts): Spotify Web API adapter with client-credentials token caching and concurrent request de-duplication.
- [`src/lib/providers/itunes-podcasts.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/providers/itunes-podcasts.ts): iTunes Search API adapter for podcasts with 600x600 high-res artwork resolution.

### 4.4 Utility Helpers & i18n
- [`src/lib/membership.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/membership.ts): Multi-tenant IDOR verification guards (`requireMembership`, `requireOwner`, `requireTitleInGroup`).
- [`src/lib/admin.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/admin.ts): Platform admin verification guard (`requireAdmin`).
- [`src/lib/invite-code.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/invite-code.ts): Generates 8-character un-ambiguous alphanumeric invite codes.
- [`src/lib/media-types.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/media-types.ts): Constants and localized labels for media categories (`book`, `movie`, `tv`, `music`, `podcast`).
- [`src/lib/utils.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/utils.ts): Tailwind CSS class merging helper (`cn(...)`).
- [`src/lib/i18n/`](file:///home/devhax/projects/fusuycorp/hepyeni/src/lib/i18n/): English (`en.ts`) and Turkish (`tr.ts`) translation dictionaries and helpers.

---

## 5. UI Components & Layouts: `src/components/`

### 5.1 Layout Components (`src/components/layout/`)
- [`app-shell.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/layout/app-shell.tsx): Root application shell orchestrating desktop sidebar and mobile navigation.
- [`desktop-sidebar.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/layout/desktop-sidebar.tsx): Persistent desktop sidebar with circle shortcuts, active path indicators, user badge, and theme toggle.

### 5.2 Domain Feature Components
- [`add-title-dialog.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/add-title-dialog.tsx): Media search and addition dialog with live provider querying and category filters.
- [`bottom-nav.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/bottom-nav.tsx): Fixed mobile navigation bar with active pill indicator.
- [`confirm-action-button.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/confirm-action-button.tsx): Confirmation modal trigger for destructive operations (leaving group, deleting circle, deleting account).
- [`copy-invite-button.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/copy-invite-button.tsx): Clipboard copy button with toast notification.
- [`group-forms.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/group-forms.tsx): Forms for creating and joining circles.
- [`mark-consumed-button.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/mark-consumed-button.tsx): One-tap action button to mark a proposal as consumed.
- [`media-badge.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/media-badge.tsx): Semantic color-coded badges for media categories.
- [`media-cover.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/media-cover.tsx): Fixed `aspect-[2/3]` image container with fallback icons for third-party cover art.
- [`rename-group-form.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/rename-group-form.tsx): In-place circle rename form.
- [`review-form.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/review-form.tsx): Interactive 5-star rating selector and text review input.
- [`theme-provider.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/theme-provider.tsx) / [`theme-toggle.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/theme-toggle.tsx): `next-themes` dark and light mode provider and toggle switch.
- [`update-name-form.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/update-name-form.tsx): User display name edit form.
- [`vote-control.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/components/vote-control.tsx): Upvote/downvote button group with optimistic score updates and net tallying.

### 5.3 UI Primitives (`src/components/ui/`)
Standardized accessible design tokens built on `@base-ui/react` and Tailwind CSS:
`alert-dialog.tsx`, `avatar.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `separator.tsx`, `skeleton.tsx`, `sonner.tsx`, `tabs.tsx`, `textarea.tsx`.

---

## 6. App Router Routes: `src/app/`

| Route | Main File | Type | Description |
|---|---|---|---|
| `/` | [`src/app/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/page.tsx) | RSC | Root entry point redirecting authenticated sessions to `/groups` and guests to `/login`. |
| `/login` | [`src/app/login/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/login/page.tsx) | Client | Unified authentication page supporting Google OAuth, Apple OAuth, Email OTP, Password login, and Password signup. |
| `/groups` | [`src/app/groups/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/groups/page.tsx) | RSC | Displays member's joined circles, owner badges, and create/join modals. |
| `/groups/[groupId]` | [`src/app/groups/[groupId]/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/groups/[groupId]/page.tsx) | RSC + Client Split | Main circle dashboard. Fetches backlog, consumed items, votes, and member list; passes data to [`group-content-view.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/groups/[groupId]/group-content-view.tsx). |
| `/groups/[groupId]/settings` | [`src/app/groups/[groupId]/settings/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/groups/[groupId]/settings/page.tsx) | RSC | Circle settings for owners: rename group, regenerate invite code, remove members, or delete circle. |
| `/groups/[groupId]/add` | [`src/app/groups/[groupId]/add/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/groups/[groupId]/add/page.tsx) | Client | Direct page version of media discovery search. |
| `/activity` | [`src/app/activity/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/activity/page.tsx) | RSC | Aggregated timeline stream of proposed media, reviews, and votes across all joined circles. |
| `/profile` | [`src/app/profile/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/profile/page.tsx) | RSC | User settings: display name editing, email display, and self-service account deletion. |
| `/admin` | [`src/app/admin/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/admin/page.tsx) | RSC | Admin overview showing total counts of users, groups, titles, votes, and reviews. |
| `/admin/users` | [`src/app/admin/users/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/admin/users/page.tsx) | RSC | User moderation list with role promotion and instant ban toggles. |
| `/admin/groups` | [`src/app/admin/groups/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/admin/groups/page.tsx) | RSC | Circle oversight list with administrative deletion. |
| `/admin/groups/[groupId]` | [`src/app/admin/groups/[groupId]/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/admin/groups/[groupId]/page.tsx) | RSC | Deep inspection of specific circle content and members. |
| `/api/auth/oauth2-callback` | [`src/app/api/auth/oauth2-callback/route.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/api/auth/oauth2-callback/route.ts) | Route Handler | Handles OAuth2 redirects (GET for Google, POST/GET for Apple), completes code exchange, and issues session cookie. |
| `/reset-password` | [`src/app/reset-password/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/reset-password/page.tsx) | Client | Form to enter new password using token from reset email. |
| `/privacy` | [`src/app/privacy/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/privacy/page.tsx) | RSC | Privacy policy statement. |
| `/terms` | [`src/app/terms/page.tsx`](file:///home/devhax/projects/fusuycorp/hepyeni/src/app/terms/page.tsx) | RSC | Terms of service statement. |

---

## 7. Automated Test Suite: `tests/`

Executed via Bun Test Runner (`bun test`):

- [`tests/vote-id.test.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/tests/vote-id.test.ts): Tests SHA-256 base36 hashing stability, length constraints ($\le 15$ chars), and deterministic reproducibility.
- [`tests/invite-code.test.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/tests/invite-code.test.ts): Tests 8-character invite code generation and character set exclusion (no ambiguous characters: `0`, `O`, `1`, `I`).
- [`tests/media-types.test.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/tests/media-types.test.ts): Validates media categories and localized label mappings.
- [`tests/membership.test.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/tests/membership.test.ts): Tests IDOR helper logic and permission validations.
- [`tests/providers.test.ts`](file:///home/devhax/projects/fusuycorp/hepyeni/tests/providers.test.ts): Validates provider registry mapping and availability checks.
