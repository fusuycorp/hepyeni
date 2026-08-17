# Titirek Documentation Index

Welcome to the **Titirek** developer and agent documentation. This directory provides an authoritative, comprehensive reference for the architecture, codebase organization, data models, authentication, external integrations, and deployment configurations of the project.

---

## Documentation Sitemap

| Document | Description |
|---|---|
| [**`ARCHITECTURE.md`**](file:///home/devhax/projects/fusuycorp/titirek/docs/ARCHITECTURE.md) | High-level system design, Next.js 15+ Server Action model, PocketBase superuser client, live session re-verification, routing/proxy gate, and concurrency handling. |
| [**`CODEBASE_MAP.md`**](file:///home/devhax/projects/fusuycorp/titirek/docs/CODEBASE_MAP.md) | Exhaustive directory tree and file-by-file breakdown covering `src/lib/`, `src/app/`, `src/components/`, `src/types/`, `pb_migrations/`, and `tests/`. |
| [**`AUTH_AND_SECURITY.md`**](file:///home/devhax/projects/fusuycorp/titirek/docs/AUTH_AND_SECURITY.md) | In-depth authentication flows (Google/Apple OAuth2, Email OTP, Password auth/reset), session cookie security, multi-tenant IDOR defense, and bounds enforcement. |
| [**`DATA_MODELS.md`**](file:///home/devhax/projects/fusuycorp/titirek/docs/DATA_MODELS.md) | PocketBase collections (`users`, `groups`, `group_members`, `titles`, `votes`, `reviews`), relations, cascading rules, and TypeScript type generation. |
| [**`EXTERNAL_APIS.md`**](file:///home/devhax/projects/fusuycorp/titirek/docs/EXTERNAL_APIS.md) | External media providers (Google Books, TMDB, Spotify, iTunes Podcasts), normalized result contract, token caching, and timeout resilience. |
| [**`DEPLOYMENT_AND_INFRA.md`**](file:///home/devhax/projects/fusuycorp/titirek/docs/DEPLOYMENT_AND_INFRA.md) | Docker containerization (`Dockerfile`, `Dockerfile.pocketbase`), Docker Swarm stack, Dokploy deployment, CI/CD pipeline, and environment variable requirements. |

---

## Quick-Reference Lookup Tables

### 1. Application Routes & Access Matrix

All routes are evaluated by the edge middleware in [`src/proxy.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/proxy.ts).

| Route Path | Type | Purpose | Access Control |
|---|---|---|---|
| `/` | Server Component | Root redirector | Authenticated $\to$ `/groups`, Guest $\to$ `/login` |
| `/login` | Client Component | Sign in / Sign up (OAuth2, OTP, Password) | Public (Redirects if already authenticated) |
| `/reset-password` | Client Component | Password reset token confirmation | Public |
| `/privacy` | Server Component | Privacy policy documentation | Public |
| `/terms` | Server Component | Terms of service documentation | Public |
| `/groups` | Server Component | Circle directory & join/create actions | **Authenticated** |
| `/groups/[groupId]` | Server Component + Client Split | Circle backlog, consumed media, voting & members | **Authenticated** + Member of Circle |
| `/groups/[groupId]/settings` | Server Component | Circle settings, rename, member management, invite code reset | **Authenticated** + Owner of Circle |
| `/groups/[groupId]/add` | Client Component | Media search modal/form (Books, Movies, TV, Music, Podcasts) | **Authenticated** + Member of Circle |
| `/activity` | Server Component | Global activity timeline across joined circles | **Authenticated** |
| `/profile` | Server Component | User profile management & account deletion | **Authenticated** |
| `/admin` | Server Component | Admin dashboard overview & statistics | **Authenticated** + `isAdmin: true` |
| `/admin/users` | Server Component | User moderation (role promotion, instant bans) | **Authenticated** + `isAdmin: true` |
| `/admin/groups` | Server Component | Platform circle oversight & deletion | **Authenticated** + `isAdmin: true` |
| `/admin/groups/[groupId]` | Server Component | Admin deep-dive into circle content & moderation | **Authenticated** + `isAdmin: true` |
| `/api/auth/oauth2-callback` | Route Handler (GET/POST) | OAuth2 authorization code callback endpoint | Public (Consumes transient state cookie) |

---

### 2. Server Actions Summary

All mutations are defined under [`src/lib/actions/`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/).

| Module | Action Function | Key Parameters | Authorization Guard | Key Side Effects |
|---|---|---|---|---|
| [`auth.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/auth.ts) | `signInWithGoogle` | None | Public | Sets OAuth2 state cookie, redirects to Google |
| [`auth.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/auth.ts) | `signInWithApple` | None | Public | Sets OAuth2 state cookie, redirects to Apple |
| [`auth.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/auth.ts) | `signInWithEmail` | `FormData` (`email`) | Public | Creates user if absent, requests OTP, sets OTP cookie |
| [`auth.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/auth.ts) | `verifyEmailCode` | `FormData` (`code`) | Public (Consumes OTP cookie) | Exchanges OTP for auth token, sets session cookie |
| [`auth.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/auth.ts) | `signInWithPassword` | `FormData` (`email`, `password`) | Public | Authenticates credentials, sets session cookie |
| [`auth.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/auth.ts) | `signUpWithPassword` | `FormData` (`email`, `password`) | Public | Creates user via superuser, authenticates, sets cookie |
| [`auth.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/auth.ts) | `requestPasswordReset` | `FormData` (`email`) | Public | Sends password reset email (anti-enumeration safe) |
| [`auth.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/auth.ts) | `confirmPasswordReset` | `FormData` (`token`, `password`, `confirm`) | Public | Validates reset token and sets new password |
| [`auth.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/auth.ts) | `signOutAction` | None | Session | Clears session cookie, redirects to `/login` |
| [`groups.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/groups.ts) | `createGroup` | `FormData` (`name`) | Session | Creates group with unique invite code, assigns owner |
| [`groups.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/groups.ts) | `joinGroup` | `FormData` (`code`) | Session | Validates code, creates `group_members` row |
| [`groups.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/groups.ts) | `renameGroup` | `groupId`, `FormData` (`name`) | `requireOwner` | Updates group name, revalidates group paths |
| [`groups.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/groups.ts) | `regenerateInviteCode` | `groupId` | `requireOwner` | Replaces invite code with new 8-char code |
| [`groups.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/groups.ts) | `removeMember` | `groupId`, `memberId` | `requireOwner` | Deletes member record from circle |
| [`groups.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/groups.ts) | `leaveGroup` | `groupId` | `requireMembership` | Removes member; deletes group if sole owner |
| [`groups.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/groups.ts) | `deleteGroup` | `groupId` | `requireOwner` | Cascades delete across all group records |
| [`titles.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/titles.ts) | `searchTitles` | `mediaType`, `query` | Session | Invokes external provider search with 8s timeout |
| [`titles.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/titles.ts) | `addTitle` | `groupId`, `mediaType`, `result` | `requireMembership` | Creates title in group (idempotent on duplicate) |
| [`titles.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/titles.ts) | `markConsumed` | `titleId`, `groupId` | `requireMembership` + `requireTitleInGroup` | Sets `status: 'consumed'` and `consumedAt` timestamp |
| [`votes.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/votes.ts) | `voteOnTitle` | `titleId`, `groupId`, `value` | `requireMembership` + `requireTitleInGroup` | Atomic vote toggle/flip via deterministic SHA-256 ID |
| [`reviews.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/reviews.ts) | `submitReview` | `titleId`, `groupId`, `FormData` | `requireMembership` + `requireTitleInGroup` | Creates or updates 1–5 star rating and comment |
| [`profile.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/profile.ts) | `updateProfileName` | `FormData` (`name`) | Session | Updates user `name` field (max 200 chars) |
| [`profile.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/profile.ts) | `deleteAccount` | None | Session | Deletes user (fails with 400 if groups/titles owned) |
| [`admin.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/admin.ts) | `setUserAdmin` | `userId`, `isAdmin` | `requireAdmin` (Not self) | Promotes/demotes user admin privileges |
| [`admin.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/admin.ts) | `banUser` | `userId` | `requireAdmin` (Not self) | Sets `bannedAt: ISOString` (instantly revokes session) |
| [`admin.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/admin.ts) | `unbanUser` | `userId` | `requireAdmin` | Sets `bannedAt: null` |
| [`admin.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/admin.ts) | `adminDeleteGroup` | `groupId` | `requireAdmin` | Cascades delete across group and children |
| [`admin.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/admin.ts) | `adminDeleteTitle` | `titleId`, `groupId` | `requireAdmin` | Verifies title in group and deletes |
| [`admin.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/admin.ts) | `adminDeleteReview` | `reviewId`, `groupId` | `requireAdmin` | Verifies review in group title and deletes |
| [`admin.ts`](file:///home/devhax/projects/fusuycorp/titirek/src/lib/actions/admin.ts) | `adminRemoveGroupMember` | `groupId`, `userId` | `requireAdmin` | Removes member from group |

---

### 3. PocketBase Collections & Relations

All collections enforce **`null` API Rules** (zero direct client SDK read/write permissions). All queries execute server-side via the superuser client.

```
users (auth)
  ▲
  │ createdBy (no cascade)
  │
groups ◄───────┐
  ▲            │
  │ group      │ group
  │ (cascade)  │ (cascade)
  │            │
group_members  titles ◄───────────────┐
                 ▲                    │
                 │ title              │ title
                 │ (cascade)          │ (cascade)
                 │                    │
               votes               reviews
```

---

### 4. External Media Providers

| Provider Identifier | Service Provider | Media Types Handled | Authentication / Keys | Query Rate / Timeout |
|---|---|---|---|---|
| `google-books` | Google Books API | `book` | None required (public endpoint) | `AbortSignal.timeout(8000)` |
| `tmdb` | The Movie Database (TMDB) | `movie`, `tv` | `TMDB_API_KEY` (v4 Read Access Bearer) | `AbortSignal.timeout(8000)` |
| `spotify` | Spotify Web API | `music` (Albums) | `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` (Client Credentials) | Token cached with in-flight request de-duplication, 8s timeout |
| `itunes` | Apple iTunes Search API | `podcast` | None required (public endpoint) | Artwork upscaled to 600x600, 8s timeout |

---

### 5. Essential Environment Variables

| Variable | Required | Scope | Description |
|---|---|---|---|
| `PB_URL` | **Yes** | Server | URL to PocketBase backend (`http://127.0.0.1:8090` in local dev). |
| `PB_SUPERUSER_EMAIL` | **Yes** | Server | PocketBase Superuser email for server-action operations. |
| `PB_SUPERUSER_PASSWORD` | **Yes** | Server | PocketBase Superuser password. |
| `APP_URL` | **Yes** (OAuth) | Server | Public frontend URL (e.g., `https://hepyeni.net` or `http://localhost:3000`). |
| `TMDB_API_KEY` | Optional | Server | TMDB v4 Bearer Token for movie and TV search. |
| `SPOTIFY_CLIENT_ID` | Optional | Server | Spotify API Client ID for music album search. |
| `SPOTIFY_CLIENT_SECRET` | Optional | Server | Spotify API Client Secret for music album search. |
| `NODE_ENV` | Optional | Server | `production` enables `secure: true` on cookies. |
