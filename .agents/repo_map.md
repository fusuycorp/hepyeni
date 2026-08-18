# Repository Map

175 files · 20737 lines of parsed code · ranked by import in-degree + 90d churn + entry points

## Entry points

- `src/app/groups/[groupId]/page.tsx`
- `src/app/groups/page.tsx`
- `src/app/login/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/groups/[groupId]/settings/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/activity/page.tsx`
- `src/app/admin/groups/[groupId]/page.tsx`
- `src/app/admin/groups/page.tsx`
- `src/app/admin/layout.tsx`
- _... +13 more entry points (ranked; see the map below)_

## Core modules

`src/components/ui/button.tsx` · 59 ln · ← [code]/page, [groupId]/page, add-title-dialog, add-title-form, +39 · 1 commit/90d
  :43   function Button(

`src/types/pocketbase-types.ts` · 318 ln · ← [groupId]/page, [titleId]/page, activity/page, add-to-shelf-dialog, +29 · 5 commits/90d
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

`src/lib/i18n/client.tsx` · 53 ln · ← add-title-dialog, add-title-form, add-to-shelf-dialog, app-shell, +28 · 1 commit/90d
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

`src/types/actions.ts` · 4 ln · ← admin, comment-thread, comments, confirm-action-button, +15 · 1 commit/90d
  :1    export type ActionResult<T = void> =

`src/lib/errors/index.ts` · 91 ln · ← admin, auth, comments, diagnostic-modal, +13 · 1 commit/90d
  :1    export type DiagnosticEntry =
  :15   export function generateTraceId(): string
  :24   export class AppError extends Error
  :49   export function logDiagnostic(
  :88   export function getRecentDiagnostics(): DiagnosticEntry[]

`src/lib/i18n/server.ts` · 20 ln · ← [code]/page, [groupId]/page, [titleId]/page, activity/page, +11 · 1 commit/90d
  :4    export async function getLocale(): Promise<Locale>
  :16   export async function getServerTranslations()

`src/components/ui/badge.tsx` · 53 ln · ← [groupId]/page, activity/page, auth-method-badges, circle-title-progress, +10 · 1 commit/90d
  :30   function Badge(

`src/lib/i18n/en.ts` · 616 ln · ← auth-methods.test, custom-titles.test, guest-management.test, i18n-exhaustive.test, +8 · 13 commits/90d
  :3    export const en: Translations =

`src/lib/i18n/tr.ts` · 614 ln · ← auth-methods.test, custom-titles.test, guest-management.test, i18n-exhaustive.test, +8 · 13 commits/90d
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

`src/lib/membership.ts` · 258 ln · ← [groupId]/page, [titleId]/page, comments, groups, +6 · 5 commits/90d
  :12   export interface CircleAccess
  :27   export const DEFAULT_GUEST_SETTINGS: GroupGuestSettings =
  :42   export function evaluateCircleAccess(
  :128  export async function resolveCircleAccess(
  :160  export async function requireMembership(
  :180  export async function requireOwner(
  :197  export async function requireTitleInGroup(
  :217  export async function requireScheduleInGroup(
  :237  export async function requireMilestoneInGroup(

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

`src/components/layout/app-shell.tsx` · 125 ln · ← [groupId]/page, [titleId]/page, activity/page, add/page, +4 · 4 commits/90d
  :14   interface AppShellProps
  :30   export function AppShell(

`src/lib/i18n/types.ts` · 618 ln · ← auth-method-badges, client, en, i18n.test, +2 · 12 commits/90d
  :1    export type Locale = "tr" | "en";
  :3    export interface Translations

`src/lib/providers/types.ts` · 16 ln · ← add-title-form, add-to-shelf-dialog, google-books, itunes-podcasts, +4 · 1 commit/90d
  :3    export type NormalizedSearchResult =
  :12   export interface MediaProvider

`src/lib/actions/groups.ts` · 434 ln · ← [code]/page, auth, groups/page, guest-settings-form, +2 · 8 commits/90d
  :17   export async function createGroup(formData: FormData): Promise<ActionResult<{ groupId: …
  :62   export async function joinGroupByCode(
  :95   export async function joinGroup(formData: FormData): Promise<ActionResult<{ groupId: st…
  :120  export async function joinGroupByCodeAction(code: string): Promise<ActionResult<{ group…
  :141  export type PublicGroupOverview =
  :157  export async function getGroupByInviteCode(
  :225  export async function autoJoinPendingInvite(
  :234  export async function setPendingInviteAction(code: string): Promise<void>
  :239  export async function renameGroup(
  :269  export async function regenerateInviteCode(
  :302  export async function removeMember(
  :336  export async function leaveGroup(groupId: string): Promise<ActionResult<void>>
  ... +2 more symbols

`src/lib/actions/progress.ts` · 423 ln · ← [titleId]/page, add-to-shelf-dialog, circle-title-progress, edit-progress-dialog, +3 · 4 commits/90d
  :22   function toIsoDate(val?: string | null): string | null
  :29   function extractErrorMessage(err: unknown, fallback: string): string
  :40   export interface SaveMediaProgressInput
  :61   export async function getPersonalShelf(
  :88   export async function saveMediaProgress(
  :198  export async function updateProgressQuickStep(
  :244  export async function deleteMediaProgress(
  :271  export interface TitleMemberProgressItem
  :277  export async function getTitleCircleProgress(
  :368  export interface CircleLiveActivityItem
  :373  export async function getCircleLiveActivity(

`src/components/copy-invite-button.tsx` · 117 ln · ← [code]/page, [groupId]/page, groups/page, settings/page · 5 commits/90d
  :10   export function CopyInviteButton(
  :24   async function copy(e: React.MouseEvent)

`src/components/ui/dialog.tsx` · 161 ln · ← add-title-dialog, add-to-shelf-dialog, diagnostic-modal, edit-progress-dialog, +3 · 1 commit/90d
  :10   function Dialog({ ...props }: DialogPrimitive.Root.Props)
  :14   function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props)
  :18   function DialogPortal({ ...props }: DialogPrimitive.Portal.Props)
  :22   function DialogClose({ ...props }: DialogPrimitive.Close.Props)
  :26   function DialogOverlay(
  :42   function DialogContent(
  :83   function DialogHeader({ className, ...props }: React.ComponentProps<"div">)
  :93   function DialogFooter(
  :120  function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props)
  :133  function DialogDescription(

`src/lib/i18n/index.ts` · 56 ln · ← [code]/page, activity/page, client, comment-thread, +3 · 1 commit/90d
  :13   export const defaultLocale: Locale = "tr";
  :15   export function getTranslations(locale: Locale = defaultLocale): Translations
  :19   export const t = getTranslations("tr");
  :21   export function formatRelativeTime(

`src/lib/actions/titles.ts` · 236 ln · ← [groupId]/page, [titleId]/page, add-title-form · 11 commits/90d
  :14   export type SearchTitlesResponse =
  :21   export async function searchTitles(
  :53   export async function addTitle(
  :113  export type CustomTitleInput =
  :120  export async function addCustomTitle(
  :181  export async function markConsumed(
  :209  export async function unmarkConsumed(

`src/components/ui/textarea.tsx` · 19 ln · ← add-to-shelf-dialog, comment-thread, edit-progress-dialog, group-schedules-card, +1 · 1 commit/90d
  :5    function Textarea({ className, ...props }: React.ComponentProps<"textarea">)

`src/components/empty-state.tsx` · 41 ln · ← activity/page, add-title-form, group-content-view, groups/page · 2 commits/90d
  :4    export function EmptyState(

`src/components/vote-control.tsx` · 170 ln · ← group-content-view, landing-view, title-detail-view · 6 commits/90d
  :11   type VoteValue = "up" | "down";
  :12   type VoteState = { score: number; userVote?: VoteValue };
  :14   export function VoteControl(
  :42   function vote(value: VoteValue)

`src/app/groups/[groupId]/add/add-title-form.tsx` · 492 ln · ← add-title-dialog, add/page · 9 commits/90d
  :21   interface AddTitleFormProps
  :27   export function AddTitleForm(
  :49   function handleSearch(e: React.FormEvent)
  :79   function handleAdd(result: NormalizedSearchResult)
  :104  function handleAddCustom(e: React.FormEvent)

`src/components/ui/alert-dialog.tsx` · 188 ln · ← comment-thread, confirm-action-button, edit-progress-dialog, group-schedules-card · 1 commit/90d
  :9    function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props)
  :13   function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props)
  :19   function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props)
  :25   function AlertDialogOverlay(
  :41   function AlertDialogContent(
  :64   function AlertDialogHeader(
  :80   function AlertDialogFooter(
  :96   function AlertDialogMedia(
  :112  function AlertDialogTitle(
  :128  function AlertDialogDescription(
  :144  function AlertDialogAction(
  :157  function AlertDialogCancel(

`src/lib/actions/comments.ts` · 150 ln · ← [groupId]/page, [titleId]/page, comment-thread · 5 commits/90d
  :13   export async function addComment(
  :78   export async function getComments(
  :104  export async function deleteComment(

`src/lib/actions/schedules.ts` · 332 ln · ← [groupId]/page, group-content-view, group-schedules-card · 5 commits/90d
  :28   function toIsoDate(val?: string | null): string | null
  :35   function extractErrorMessage(err: unknown, fallback: string): string
  :46   export interface CreateScheduleMilestoneInput
  :52   export interface CreateGroupScheduleInput
  :61   export interface MilestoneWithCheckins extends ScheduleMilestonesResponse
  :66   export interface GroupScheduleWithMilestones extends GroupSchedulesResponse
  :72   export async function getGroupSchedules(
  :155  export async function createGroupSchedule(
  :240  export async function updateGroupScheduleStatus(
  :266  export async function deleteGroupSchedule(
  :291  export async function toggleMilestoneCheckin(

`src/lib/providers/index.ts` · 27 ln · ← add-title-form, providers.test, search/route, titles · 1 commit/90d
  :16   export function getProvider(mediaType: MediaType): MediaProvider
  :24   export function isProviderAvailable(mediaType: MediaType): boolean

`src/app/groups/[groupId]/page.tsx` · 314 ln · 14 commits/90d · entry point
  :27   type TitleExpand =
  :33   export default async function GroupPage(
  :128  async function handleVote(titleId: string, value: "up" | "down")
  :133  async function handleMarkConsumed(titleId: string)
  :138  async function handleUnmarkConsumed(titleId: string)
  :143  async function handleSubmitReview(titleId: string, formData: FormData)
  :148  async function handleAddComment(titleId: string, formData: FormData)
  :153  async function handleDeleteComment(commentId: string)
  :158  async function handleGetComments(titleId: string)

`src/app/groups/page.tsx` · 178 ln · 11 commits/90d · entry point
  :21   export default async function GroupsPage()

`src/app/login/page.tsx` · 293 ln · 12 commits/90d · entry point
  :32   export default async function LoginPage(

`src/lib/actions/admin.ts` · 190 ln · ← [groupId]/page, groups/page, users/page · 4 commits/90d
  :15   async function requireCallerAdmin()
  :22   export async function setUserAdmin(
  :43   export async function banUser(userId: string): Promise<ActionResult<void>>
  :63   export async function unbanUser(userId: string): Promise<ActionResult<void>>
  :78   export async function adminDeleteGroup(groupId: string): Promise<ActionResult<void>>
  :93   export async function adminDeleteTitle(
  :123  export async function adminDeleteReview(
  :158  export async function adminRemoveGroupMember(

`src/app/profile/page.tsx` · 236 ln · 9 commits/90d · entry point
  :23   export default async function ProfilePage()

`src/app/groups/[groupId]/settings/page.tsx` · 311 ln · 8 commits/90d · entry point
  :29   export default async function GroupSettingsPage(

`src/components/mark-consumed-button.tsx` · 68 ln · ← group-content-view, title-detail-view · 6 commits/90d
  :11   export function MarkConsumedButton(

`src/lib/actions/reviews.ts` · 65 ln · ← [groupId]/page, [titleId]/page · 6 commits/90d
  :11   export async function submitReview(

`src/lib/actions/votes.ts` · 67 ln · ← [groupId]/page, [titleId]/page · 6 commits/90d
  :13   export async function voteOnTitle(

`src/lib/comments.ts` · 74 ln · ← comment-thread, comments, comments.test · 2 commits/90d
  :1    export function validateCommentContent(raw: unknown): string
  :15   export function canDeleteComment(
  :33   export type CommentNode<T> = T &
  :37   export function organizeCommentsTree<

`src/app/admin/users/page.tsx` · 133 ln · 7 commits/90d · entry point
  :14   export default async function AdminUsersPage()

`src/components/confirm-action-button.tsx` · 106 ln · ← profile/page, settings/page · 5 commits/90d
  :21   export function ConfirmActionButton(

`src/components/review-form.tsx` · 96 ln · ← group-content-view, title-detail-view · 5 commits/90d
  :12   export function ReviewForm(
  :28   function handleSubmit(e: React.FormEvent<HTMLFormElement>)

`src/components/ui/label.tsx` · 21 ln · ← add-to-shelf-dialog, edit-progress-dialog, group-schedules-card · 1 commit/90d
  :7    function Label({ className, ...props }: React.ComponentProps<"label">)

`src/lib/providers/google-books.ts` · 178 ln · ← providers.test, providers/index · 5 commits/90d
  :4    type GoogleBooksItem =
  :16   type ItunesEbookResult =
  :25   type OpenLibraryDoc =
  :34   async function searchItunesBooks(query: string): Promise<NormalizedSearchResult[]>
  :66   async function searchOpenLibrary(query: string): Promise<NormalizedSearchResult[]>
  :103  export const googleBooksProvider: MediaProvider =

`src/app/activity/page.tsx` · 359 ln · 6 commits/90d · entry point
  :25   type ActivityItem =
  :48   export default async function ActivityPage()

`src/app/admin/groups/[groupId]/page.tsx` · 251 ln · 6 commits/90d · entry point
  :26   type TitleExpand =
  :32   export default async function AdminGroupDetailPage(

`src/app/admin/groups/page.tsx` · 138 ln · 6 commits/90d · entry point
  :17   export default async function AdminGroupsPage()

`src/app/admin/layout.tsx` · 80 ln · 6 commits/90d · entry point
  :11   export default async function AdminLayout(

`src/app/api/auth/oauth2-callback/route.ts` · 97 ln · 6 commits/90d · entry point
  :13   async function handleCallback(
  :79   export async function GET(req: NextRequest)
  :89   export async function POST(req: NextRequest)

`src/app/layout.tsx` · 64 ln · 6 commits/90d · entry point
  :19   export async function generateMetadata(): Promise<Metadata>
  :27   export const viewport =
  :32   export default async function RootLayout({ children }: LayoutProps<"/">)

`src/app/shelf/add-to-shelf-dialog.tsx` · 433 ln · ← circle-title-progress, shelf-view · 4 commits/90d
  :31   export function AddToShelfDialog()

`src/app/shelf/edit-progress-dialog.tsx` · 370 ln · ← circle-title-progress, shelf-view · 4 commits/90d
  :38   interface EditProgressDialogProps
  :44   export function EditProgressDialog(

`src/app/admin/page.tsx` · 136 ln · 5 commits/90d · entry point
  :8    export default async function AdminDashboardPage()

`src/app/groups/[groupId]/add/page.tsx` · 69 ln · 5 commits/90d · entry point
  :9    export default async function AddTitlePage(

`src/components/add-title-dialog.tsx` · 78 ln · ← [groupId]/page, group-content-view · 3 commits/90d
  :17   interface AddTitleDialogProps
  :25   export function AddTitleDialog(
  :38   function handleSuccess()

`src/components/comment-thread.tsx` · 547 ln · ← media-comments, title-detail-view · 3 commits/90d
  :29   export type OptimisticComment =
  :38   export type DisplayComment =
  :42   export interface CommentThreadProps
  :65   export function CommentThread(
  :121  async function handleAddComment(e: React.FormEvent<HTMLFormElement>)
  :187  function handleDeleteComment(commentId: string)
  :215  function handleStartReply(commentId: string, authorName: string)
  :222  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>)

`src/components/inline-text-form.tsx` · 60 ln · ← profile/page, settings/page · 3 commits/90d
  :10   export function InlineTextForm(
  :32   function handleSubmit(e: React.FormEvent<HTMLFormElement>)

`src/lib/providers/spotify.ts` · 146 ln · ← providers.test, providers/index · 3 commits/90d
  :4    type SpotifyAlbum =
  :12   type ItunesAlbumResult =
  :23   async function fetchAccessToken(): Promise<string>
  :52   async function getAccessToken(): Promise<string>
  :64   async function searchItunesMusic(query: string): Promise<NormalizedSearchResult[]>
  :95   export const spotifyProvider: MediaProvider =

`src/lib/providers/tmdb.ts` · 120 ln · ← providers.test, providers/index · 3 commits/90d
  :4    type TmdbResult =
  :14   type ItunesVideoResult =
  :26   async function searchItunesVideo(
  :63   function makeTmdbProvider(
  :117  export const tmdbMovieProvider = makeTmdbProvider("movie", "movie");
  :118  export const tmdbTvProvider = makeTmdbProvider("tv", "tv");

`src/app/reset-password/page.tsx` · 109 ln · 4 commits/90d · entry point
  :10   export default async function ResetPasswordPage(

`src/lib/admin.ts` · 10 ln · ← admin, admin/layout · 2 commits/90d
  :4    export async function requireAdmin(userId: string): Promise<UsersResponse>

`src/lib/providers/itunes-podcasts.ts` · 39 ln · ← providers.test, providers/index · 2 commits/90d
  :3    type ItunesResult =
  :11   export const itunesPodcastProvider: MediaProvider =

`src/app/groups/[groupId]/titles/[titleId]/page.tsx` · 171 ln · 3 commits/90d · entry point
  :21   type TitleExpand =
  :27   export default async function TitleDetailPage(
  :101  async function handleVote(value: "up" | "down")
  :106  async function handleMarkConsumed()
  :111  async function handleUnmarkConsumed()
  :116  async function handleSubmitReview(formData: FormData)
  :121  async function handleAddComment(targetTitleId: string, formData: FormData)
  :126  async function handleDeleteComment(commentId: string)
  :131  async function handleGetComments(targetTitleId: string)

`src/app/page.tsx` · 31 ln · 3 commits/90d · entry point
  :6    export default async function Home()

`src/lib/invite-code.ts` · 7 ln · ← groups, invite-code.test · 1 commit/90d
  :3    export function generateInviteCode(length = 8): string

`src/lib/pocketbase/vote-id.ts` · 35 ln · ← vote-id.test, votes · 1 commit/90d
  :9    export async function voteRecordId(

`src/app/privacy/page.tsx` · 194 ln · 2 commits/90d · entry point
  :9    export const metadata: Metadata =
  :14   export default function PrivacyPolicyPage()

`src/app/terms/page.tsx` · 162 ln · 2 commits/90d · entry point
  :8    export const metadata: Metadata =
  :13   export default function TermsOfServicePage()

`src/app/api/titles/search/route.ts` · 53 ln · 1 commit/90d · entry point
  :8    export async function GET(req: NextRequest)

`src/app/invite/[code]/page.tsx` · 215 ln · 1 commit/90d · entry point
  :23   export default async function InvitePage(

`src/app/invite/page.tsx` · 80 ln · 1 commit/90d · entry point
  :11   export default async function InviteRootPage(

`src/app/shelf/page.tsx` · 39 ln · 1 commit/90d · entry point
  :10   export default async function ShelfPage()

## Supporting files

`src/app/groups/[groupId]/group-content-view.tsx` · 820 ln · ← [groupId]/page · 12 commits/90d · :35 type TitleWithScore = TitlesResponse< · :44 interface GroupContentViewProps · :80 export function GroupContentView

`src/components/layout/desktop-sidebar.tsx` · 169 ln · ← app-shell · 7 commits/90d · :15 interface DesktopSidebarProps · :25 export function DesktopSidebar

`src/components/media-comments.tsx` · 127 ln · ← group-content-view · 7 commits/90d · :23 interface MediaCommentsProps · :46 export function MediaComments

`src/components/group-forms.tsx` · 173 ln · ← groups/page · 6 commits/90d · :13 function errorMessage · :17 export function CreateGroupCard · :26 function handleSubmit · :95 export function JoinGroupCard · :104 function handleSubmit

`src/proxy.ts` · 46 ln · 11 commits/90d · :9 export default async function proxy · :37 export const config =

`src/components/bottom-nav.tsx` · 53 ln · ← app-shell · 5 commits/90d · :9 export function BottomNav

`src/app/groups/[groupId]/titles/[titleId]/title-detail-view.tsx` · 559 ln · ← [titleId]/page · 4 commits/90d · :45 type TitleWithScore = TitlesResponse< · :54 interface TitleDetailViewProps · :85 export function TitleDetailView · :149 async function handleCopyLink

`src/lib/actions/profile.ts` · 58 ln · ← profile/page · 4 commits/90d · :10 export async function updateProfileName · :35 export async function deleteAccount

`src/app/shelf/shelf-view.tsx` · 336 ln · ← shelf/page · 3 commits/90d · :33 interface ShelfViewProps · :37 export function ShelfView

`src/components/forgot-password-form.tsx` · 40 ln · ← login/page · 3 commits/90d · :9 export function ForgotPasswordForm · :22 function handleSubmit

`src/components/group-schedules-card.tsx` · 559 ln · ← group-content-view · 3 commits/90d · :45 type GroupScheduleWithMilestones, · :52 interface GroupSchedulesCardProps · :61 export function GroupSchedulesCard

`src/components/send-reset-link-button.tsx` · 32 ln · ← profile/page · 3 commits/90d · :8 export function SendResetLinkButton

`src/app/groups/[groupId]/settings/guest-settings-form.tsx` · 339 ln · ← settings/page · 2 commits/90d · :28 interface GuestSettingsFormProps · :34 export function GuestSettingsForm

`src/app/landing-view.tsx` · 566 ln · ← app/page · 2 commits/90d · :35 interface LandingViewProps · :44 export function LandingView

`src/app/invite/[code]/invite-cta.tsx` · 123 ln · ← [code]/page · 1 commit/90d · :15 export function InviteCTA · :30 async function handleDirectJoin · :42 async function handleAuthRedirect

`src/app/invite/enter-code-form.tsx` · 63 ln · ← invite/page · 1 commit/90d · :10 export function EnterCodeForm

`src/components/auth-method-badges.tsx` · 224 ln · ← profile/page · 1 commit/90d · :7 export function GoogleIcon · :30 export function AppleIcon · :38 export function PasswordIcon · :42 export function EmailOtpIcon · :46 export interface AuthMethodHeaderBadgesProps · :51 export function AuthMethodHeaderBadges

`src/components/circle-title-progress.tsx` · 173 ln · ← title-detail-view · 1 commit/90d · :17 interface CircleTitleProgressProps · :24 export function CircleTitleProgress

`src/components/diagnostic-modal.tsx` · 189 ln · ← profile/page · 1 commit/90d · :27 export function DiagnosticModal · :38 async function loadDiagnostics · :50 async function copyReport

`src/components/theme-provider.tsx` · 12 ln · ← app/layout · 1 commit/90d · :6 export function ThemeProvider

`src/components/ui/separator.tsx` · 26 ln · ← login/page · 1 commit/90d · :7 function Separator

`src/components/ui/tabs.tsx` · 83 ln · ← login/page · 1 commit/90d · :8 function Tabs · :41 function TabsList · :56 function TabsTrigger · :72 function TabsContent

`src/lib/actions/diagnostics.ts` · 12 ln · ← diagnostic-modal · 1 commit/90d · :6 export async function getDiagnosticsAction

`src/app/error.tsx` · 99 ln · 2 commits/90d · :9 export default function RootError

`src/app/global-error.tsx` · 83 ln · 2 commits/90d · :6 export default function GlobalError

`tests/comments.test.ts` · 196 ln · 2 commits/90d · :186 function resolveParentId

`src/app/shelf/error.tsx` · 58 ln · 1 commit/90d · :9 export default function ShelfError

`src/components/ui/skeleton.tsx` · 14 ln · 1 commit/90d · :3 function Skeleton

`tests/auth-methods.test.ts` · 110 ln · 1 commit/90d · :57 function extractAuthMethods

`tests/guest-management.test.ts` · 334 ln · 1 commit/90d · :11 function createMockGroup · :26 function createMockMembership

`tests/i18n-exhaustive.test.ts` · 69 ln · 1 commit/90d · :6 function compareObjects · :54 function assertNoEmptyStrings

`tests/i18n.test.ts` · 119 ln · 1 commit/90d · :36 function secondsAgo

`tests/progress.test.ts` · 117 ln · 1 commit/90d · :9 function calculateProgressPercentage · :22 function applyQuickStep · :34 function filterCircleVisibleProgress

`tests/schedules.test.ts` · 129 ln · 1 commit/90d · :5 function calculateMilestoneCompletionRate · :13 function orderMilestones<T extends { orderIndex?: number; targetDate?: string }>

## Other files

- `.` — 19 files ((no ext), .example, .json, .lock)
- `.agents/` — 4 files (.jsonl, .md)
- `.github/workflows/` — `deploy.yml`
- `docs/` — 7 files (.md)
- `pb_migrations/` — 5 files (.js)
- `public/` — 5 files (.svg)
- `src/app/` — `globals.css`, `favicon.ico`
- `src/components/ui/` — `sonner.tsx`
- `tests/` — 13 files (.ts)

_Detailed 118 of 175 files; 57 collapsed above._