# Repository Map

173 files · 19977 lines of parsed code · ranked by import in-degree + 90d churn + entry points

## Entry points

- `src/app/groups/[groupId]/page.tsx`
- `src/app/groups/page.tsx`
- `src/app/login/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/groups/[groupId]/settings/page.tsx`
- `src/app/activity/page.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/api/auth/oauth2-callback/route.ts`
- `src/app/layout.tsx`
- _... +13 more entry points (ranked; see the map below)_

## Core modules

`src/components/ui/button.tsx` · 59 ln · ← [code]/page, [groupId]/page, add-title-dialog, add-title-form, +39 · 1 commit/90d
  :43   function Button(

`src/types/pocketbase-types.ts` · 318 ln · ← [groupId]/page, [titleId]/page, activity/page, add-to-shelf-dialog, +29 · 4 commits/90d
  :17   export const Collections =
  :35   export type Collections = (typeof Collections)[keyof typeof Collections];
  :38   export type IsoDateString = string;
  :39   export type IsoAutoDateString = string & { readonly autodate: unique symbol };
  :40   export type RecordIdString = string;
  :41   export type FileNameString = string & { readonly filename: unique symbol };
  :43   type ExpandType<T> = unknown extends T
  :50   export type BaseSystemFields<T = unknown> =
  :56   export type AuthSystemFields<T = unknown> =
  :62   export type CommentsRecord =
  :72   export const GroupMembersRoleOptions =
  :76   export type GroupMembersRoleOptions =
  ... +37 more symbols

`src/lib/utils.ts` · 7 ln · ← add-title-form, add-to-shelf-dialog, alert-dialog, app-shell, +30 · 1 commit/90d
  :4    export function cn(...inputs: ClassValue[])

`src/lib/i18n/client.tsx` · 53 ln · ← add-title-dialog, add-title-form, add-to-shelf-dialog, app-shell, +27 · 1 commit/90d
  :7    interface I18nContextType
  :15   export function I18nProvider(
  :38   export function useI18n()
  :46   export function useLocale()
  :50   export function useTranslations()

`src/lib/pocketbase/session.ts` · 215 ln · ← [code]/page, [groupId]/page, [titleId]/page, activity/page, +25 · 5 commits/90d
  :9    export type Session =
  :16   export function getPbUrl(): string
  :31   export async function getSessionFromToken(
  :56   export async function getSession(): Promise<Session | null>
  :63   export async function setSessionCookie(token: string): Promise<void>
  :74   export async function clearSessionCookie(): Promise<void>
  :79   export const SESSION_COOKIE_NAME = SESSION_COOKIE;
  :84   export type OAuth2State =
  :92   export function getRequestOrigin(req?:
  :113  export function oauth2RedirectUrl(origin?: string): string
  :122  export type OtpState = { email: string; otpId: string };
  :124  export async function setOtpCookie(data: OtpState): Promise<void>
  ... +8 more symbols

`src/lib/pocketbase/superuser.ts` · 74 ln · ← [groupId]/page, [titleId]/page, activity/page, add/page, +18 · 3 commits/90d
  :14   function createClient(): PocketBase
  :25   async function ensureAuthenticated(): Promise<void>
  :70   export async function getSuperuserClient(): Promise<PocketBase>

`src/components/ui/card.tsx` · 104 ln · ← [code]/page, [groupId]/page, activity/page, add-title-form, +19 · 1 commit/90d
  :5    function Card(
  :23   function CardHeader({ className, ...props }: React.ComponentProps<"div">)
  :36   function CardTitle({ className, ...props }: React.ComponentProps<"div">)
  :49   function CardDescription({ className, ...props }: React.ComponentProps<"div">)
  :59   function CardAction({ className, ...props }: React.ComponentProps<"div">)
  :72   function CardContent({ className, ...props }: React.ComponentProps<"div">)
  :82   function CardFooter({ className, ...props }: React.ComponentProps<"div">)

`src/lib/i18n/server.ts` · 20 ln · ← [code]/page, [groupId]/page, [titleId]/page, activity/page, +11 · 1 commit/90d
  :4    export async function getLocale(): Promise<Locale>
  :16   export async function getServerTranslations()

`src/components/ui/badge.tsx` · 53 ln · ← [groupId]/page, activity/page, auth-method-badges, circle-title-progress, +10 · 1 commit/90d
  :30   function Badge(

`src/lib/i18n/en.ts` · 616 ln · ← auth-methods.test, custom-titles.test, guest-management.test, i18n-exhaustive.test, +8 · 11 commits/90d
  :3    export const en: Translations =

`src/lib/i18n/tr.ts` · 614 ln · ← auth-methods.test, custom-titles.test, guest-management.test, i18n-exhaustive.test, +8 · 11 commits/90d
  :3    export const tr: Translations =

`src/lib/pocketbase/errors.ts` · 20 ln · ← [groupId]/page, add/page, admin, auth, +8 · 1 commit/90d
  :5    export function isValidationNotUnique(err: unknown, field?: string): boolean
  :17   export function isNotFound(err: unknown): boolean

`src/components/ui/avatar.tsx` · 110 ln · ← activity/page, circle-title-progress, comment-thread, desktop-sidebar, +7 · 1 commit/90d
  :8    function Avatar(
  :28   function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props)
  :41   function AvatarFallback(
  :57   function AvatarBadge({ className, ...props }: React.ComponentProps<"span">)
  :73   function AvatarGroup({ className, ...props }: React.ComponentProps<"div">)
  :86   function AvatarGroupCount(

`src/lib/format.ts` · 9 ln · ← activity/page, circle-title-progress, comment-thread, desktop-sidebar, +7 · 1 commit/90d
  :1    export function getInitials(name?: string, email?: string): string
  :6    export function getDisplayName(user?: { name?: string; email?: string }): string

`src/lib/membership.ts` · 214 ln · ← [groupId]/page, [titleId]/page, comments, groups, +6 · 4 commits/90d
  :10   export interface CircleAccess
  :25   export const DEFAULT_GUEST_SETTINGS: GroupGuestSettings =
  :40   export function evaluateCircleAccess(
  :126  export async function resolveCircleAccess(
  :158  export async function requireMembership(
  :178  export async function requireOwner(
  :195  export async function requireTitleInGroup(

`src/components/media-badge.tsx` · 64 ln · ← [code]/page, [groupId]/page, activity/page, add-title-form, +6 · 3 commits/90d
  :8    interface MediaBadgeProps
  :31   export function MediaBadge(

`src/components/theme-toggle.tsx` · 51 ln · ← [code]/page, admin/layout, app-shell, desktop-sidebar, +6 · 2 commits/90d
  :10   export function ThemeToggle({ className }: { className?: string })

`src/lib/actions/auth.ts` · 294 ln · ← auth-method-badges, auth-methods.test, desktop-sidebar, forgot-password-form, +4 · 11 commits/90d
  :21   export type UserAuthMethods =
  :27   export async function getUserAuthMethods(
  :54   export async function getAvailableAuthProviders(): Promise<
  :72   async function signInWithOAuth2(provider: "google" | "apple")
  :113  export async function signInWithGoogle()
  :117  export async function signInWithApple()
  :122  export async function signInWithEmail(formData: FormData)
  :155  export async function verifyEmailCode(formData: FormData)
  :183  export async function signInWithPassword(formData: FormData)
  :208  export async function signUpWithPassword(formData: FormData)
  :249  export async function requestPasswordReset(formData: FormData)
  :266  export async function confirmPasswordReset(formData: FormData)
  ... +1 more symbols

`src/components/ui/input.tsx` · 21 ln · ← add-title-form, add-to-shelf-dialog, edit-progress-dialog, enter-code-form, +6 · 1 commit/90d
  :6    function Input({ className, type, ...props }: React.ComponentProps<"input">)

`src/lib/media-types.ts` · 5 ln · ← add-title-form, add-to-shelf-dialog, group-content-view, media-badge, +5 · 3 commits/90d
  :1    export const MEDIA_TYPES = ["book", "movie", "tv", "music", "podcast"] as const;
  :3    export type MediaType = (typeof MEDIA_TYPES)[number];

`src/components/language-toggle.tsx` · 39 ln · ← [code]/page, admin/layout, app-shell, desktop-sidebar, +5 · 2 commits/90d
  :8    export function LanguageToggle({ className }: { className?: string })
  :12   function toggleLanguage()

`src/components/media-cover.tsx` · 61 ln · ← [code]/page, activity/page, add-title-form, add-to-shelf-dialog, +5 · 2 commits/90d
  :12   export function MediaCover(

`src/lib/errors/index.ts` · 91 ln · ← auth, diagnostic-modal, diagnostics, errors.test, +5 · 1 commit/90d
  :1    export type DiagnosticEntry =
  :15   export function generateTraceId(): string
  :24   export class AppError extends Error
  :49   export function logDiagnostic(
  :88   export function getRecentDiagnostics(): DiagnosticEntry[]

`src/components/layout/app-shell.tsx` · 125 ln · ← [groupId]/page, [titleId]/page, activity/page, add/page, +4 · 4 commits/90d
  :14   interface AppShellProps
  :30   export function AppShell(

`src/lib/i18n/types.ts` · 618 ln · ← auth-method-badges, client, en, i18n.test, +2 · 11 commits/90d
  :1    export type Locale = "tr" | "en";
  :3    export interface Translations

`src/lib/providers/types.ts` · 16 ln · ← add-title-form, add-to-shelf-dialog, google-books, itunes-podcasts, +4 · 1 commit/90d
  :3    export type NormalizedSearchResult =
  :12   export interface MediaProvider

`src/lib/actions/groups.ts` · 348 ln · ← [code]/page, auth, groups/page, guest-settings-form, +2 · 7 commits/90d
  :29   export async function createGroup(formData: FormData): Promise<string>
  :66   export async function joinGroupByCode(
  :101  export async function joinGroup(formData: FormData): Promise<string>
  :112  export async function joinGroupByCodeAction(code: string): Promise<string>
  :124  export type PublicGroupOverview =
  :140  export async function getGroupByInviteCode(
  :208  export async function autoJoinPendingInvite(
  :217  export async function setPendingInviteAction(code: string): Promise<void>
  :223  export async function renameGroup(groupId: string, formData: FormData)
  :238  export async function regenerateInviteCode(groupId: string)
  :260  export async function removeMember(groupId: string, memberId: string)
  :280  export async function leaveGroup(groupId: string)
  ... +2 more symbols

`src/components/copy-invite-button.tsx` · 117 ln · ← [code]/page, [groupId]/page, groups/page, settings/page · 5 commits/90d
  :10   export function CopyInviteButton(
  :24   async function copy(e: React.MouseEvent)

## Other files

- `.` — 19 files ((no ext), .example, .json, .lock)
- `.agents/` — 4 files (.jsonl, .md)
- `.github/` — 1 files (.yml)
- `docs/` — 7 files (.md)
- `pb_migrations/` — 5 files (.js)
- `public/` — 5 files (.svg)
- `src/` — 84 files (.css, .ico, .ts, .tsx)
- `tests/` — 20 files (.ts)

_Detailed 28 of 173 files; 145 collapsed above._
_Output hit the 12000-char budget — lower-ranked files were collapsed, not dropped. Raise with `agent-ctx map --budget N`, or use Grep for exact locations._