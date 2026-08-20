# Repository Map

223 files · 31597 lines of parsed code · ranked by import in-degree + 90d churn + entry points

## Entry points

- `src/app/groups/[groupId]/page.tsx`
- `src/app/groups/page.tsx`
- `src/app/login/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/groups/[groupId]/settings/page.tsx`
- `src/app/activity/page.tsx`
- `src/app/admin/groups/[groupId]/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/layout.tsx`
- `src/app/admin/groups/page.tsx`
- _... +14 more entry points (ranked; see the map below)_

## Core modules

`src/types/pocketbase-types.ts` · 355 ln · ← [groupId]/page, [titleId]/page, activity/page, add-quote-dialog, +47 · 7 commits/90d
  :20   export const Collections =
  :40   export type Collections = (typeof Collections)[keyof typeof Collections];
  :43   export type IsoDateString = string;
  :44   export type IsoAutoDateString = string & { readonly autodate: unique symbol };
  :45   export type RecordIdString = string;
  :46   export type FileNameString = string & { readonly filename: unique symbol };
  :48   type ExpandType<T> = unknown extends T
  :55   export type BaseSystemFields<T = unknown> =
  :61   export type AuthSystemFields<T = unknown> =
  :67   export type CommentsRecord =
  :77   export const GroupMembersRoleOptions =
  :81   export type GroupMembersRoleOptions =
  ... +41 more symbols

`src/components/ui/button.tsx` · 59 ln · ← [code]/page, [groupId]/page, add-quote-dialog, add-title-dialog, +48 · 1 commit/90d
  :43   function Button(

`src/lib/i18n/client.tsx` · 53 ln · ← add-quote-dialog, add-title-dialog, add-title-form, add-to-shelf-dialog, +42 · 1 commit/90d
  :7    interface I18nContextType
  :15   export function I18nProvider(
  :38   export function useI18n()
  :46   export function useLocale()
  :50   export function useTranslations()

`src/lib/utils.ts` · 7 ln · ← add-title-form, add-to-shelf-dialog, alert-dialog, app-shell, +42 · 1 commit/90d
  :4    export function cn(...inputs: ClassValue[])

`src/lib/pocketbase/session.ts` · 215 ln · ← [code]/page, [groupId]/page, [titleId]/page, activity/page, +28 · 5 commits/90d
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

`src/components/ui/card.tsx` · 104 ln · ← [code]/page, [groupId]/page, activity/page, add-title-form, +23 · 1 commit/90d
  :5    function Card(
  :23   function CardHeader({ className, ...props }: React.ComponentProps<"div">)
  :36   function CardTitle({ className, ...props }: React.ComponentProps<"div">)
  :49   function CardDescription({ className, ...props }: React.ComponentProps<"div">)
  :59   function CardAction({ className, ...props }: React.ComponentProps<"div">)
  :72   function CardContent({ className, ...props }: React.ComponentProps<"div">)
  :82   function CardFooter({ className, ...props }: React.ComponentProps<"div">)

`src/lib/pocketbase/superuser.ts` · 74 ln · ← [groupId]/page, [titleId]/page, activity/page, add/page, +21 · 3 commits/90d
  :14   function createClient(): PocketBase
  :25   async function ensureAuthenticated(): Promise<void>
  :70   export async function getSuperuserClient(): Promise<PocketBase>

`src/types/actions.ts` · 4 ln · ← actions, admin, comment-thread, comments, +19 · 1 commit/90d
  :1    export type ActionResult<T = void> =

`src/components/ui/badge.tsx` · 53 ln · ← [groupId]/page, activity/page, auth-method-badges, blind-pick-toggle-form, +17 · 1 commit/90d
  :30   function Badge(

`src/lib/errors/index.ts` · 91 ln · ← actions, admin, auth, comments, +16 · 1 commit/90d
  :1    export type DiagnosticEntry =
  :15   export function generateTraceId(): string
  :24   export class AppError extends Error
  :49   export function logDiagnostic(
  :88   export function getRecentDiagnostics(): DiagnosticEntry[]

`src/lib/i18n/en.ts` · 829 ln · ← auth-methods.test, custom-titles.test, flags.test, guest-management.test, +12 · 15 commits/90d
  :3    export const en: Translations =

`src/lib/i18n/tr.ts` · 827 ln · ← auth-methods.test, custom-titles.test, flags.test, guest-management.test, +12 · 15 commits/90d
  :3    export const tr: Translations =

`src/lib/i18n/server.ts` · 20 ln · ← [code]/page, [groupId]/page, [titleId]/page, activity/page, +12 · 1 commit/90d
  :4    export async function getLocale(): Promise<Locale>
  :16   export async function getServerTranslations()

`src/lib/moods.ts` · 262 ln · ← [groupId]/page, [titleId]/page, add-title-form, add-to-shelf-dialog, +10 · 1 commit/90d
  :1    export const MOODS = [
  :13   export type MoodType = (typeof MOODS)[number];
  :15   export const PACES = ["slow_burn", "gentle", "fast_paced"] as const;
  :17   export type PaceType = (typeof PACES)[number];
  :19   export const MOOD_DETAILS: Record<
  :79   export const PACE_DETAILS: Record<
  :103  export function isMood(val: unknown): val is MoodType
  :107  export function isPace(val: unknown): val is PaceType
  :111  export function normalizeMoods(raw: unknown): MoodType[]
  :118  export function normalizePace(raw: unknown): PaceType | undefined
  :123  export function filterTitlesByMood<
  :145  export function shouldRedactProposalIdentity(
  ... +4 more symbols

`src/components/media-badge.tsx` · 64 ln · ← [code]/page, [groupId]/page, activity/page, add-title-form, +9 · 3 commits/90d
  :8    interface MediaBadgeProps
  :31   export function MediaBadge(

`src/lib/format.ts` · 14 ln · ← activity/page, adversarial-fuzzing.test, circle-title-progress, comment-thread, +9 · 1 commit/90d
  :1    export function getInitials(name?: string, email?: string): string
  :8    export function getDisplayName(user?: { name?: string; email?: string }): string

`src/components/ui/avatar.tsx` · 110 ln · ← activity/page, circle-title-progress, comment-thread, desktop-sidebar, +8 · 1 commit/90d
  :8    function Avatar(
  :28   function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props)
  :41   function AvatarFallback(
  :57   function AvatarBadge({ className, ...props }: React.ComponentProps<"span">)
  :73   function AvatarGroup({ className, ...props }: React.ComponentProps<"div">)
  :86   function AvatarGroupCount(

`src/components/ui/input.tsx` · 21 ln · ← add-quote-dialog, add-title-form, add-to-shelf-dialog, edit-progress-dialog, +8 · 1 commit/90d
  :6    function Input({ className, type, ...props }: React.ComponentProps<"input">)

`src/lib/membership.ts` · 258 ln · ← [groupId]/page, [titleId]/page, comments, groups, +7 · 5 commits/90d
  :12   export interface CircleAccess
  :27   export const DEFAULT_GUEST_SETTINGS: GroupGuestSettings =
  :42   export function evaluateCircleAccess(
  :128  export async function resolveCircleAccess(
  :160  export async function requireMembership(
  :180  export async function requireOwner(
  :197  export async function requireTitleInGroup(
  :217  export async function requireScheduleInGroup(
  :237  export async function requireMilestoneInGroup(

`src/lib/pocketbase/errors.ts` · 20 ln · ← [groupId]/page, add/page, admin, auth, +8 · 1 commit/90d
  :5    export function isValidationNotUnique(err: unknown, field?: string): boolean
  :17   export function isNotFound(err: unknown): boolean

`src/components/media-cover.tsx` · 61 ln · ← [code]/page, activity/page, add-title-form, add-to-shelf-dialog, +6 · 2 commits/90d
  :12   export function MediaCover(

`src/components/theme-toggle.tsx` · 53 ln · ← [code]/page, admin/layout, app-shell, desktop-sidebar, +6 · 2 commits/90d
  :11   export function ThemeToggle({ className }: { className?: string })

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

`src/components/ui/dialog.tsx` · 161 ln · ← add-quote-dialog, add-title-dialog, add-to-shelf-dialog, decision-wheel-dialog, +6 · 1 commit/90d
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

`src/lib/flags/client.tsx` · 66 ln · ← add-title-form, add-to-shelf-dialog, app/layout, blind-pick-toggle-form, +6 · 1 commit/90d
  :6    interface FeatureFlagsContextType
  :21   export interface FeatureFlagsProviderProps
  :27   export function FeatureFlagsProvider(
  :54   export function useFeatureFlags(): Record<FeatureFlagKey, boolean>
  :62   export function useFeatureFlag(flagKey: FeatureFlagKey): boolean

`src/components/layout/app-shell.tsx` · 125 ln · ← [groupId]/page, [titleId]/page, activity/page, add/page, +5 · 4 commits/90d
  :14   interface AppShellProps
  :30   export function AppShell(

`src/lib/media-types.ts` · 5 ln · ← add-title-form, add-to-shelf-dialog, group-content-view, media-badge, +5 · 3 commits/90d
  :1    export const MEDIA_TYPES = ["book", "movie", "tv", "music", "podcast"] as const;
  :3    export type MediaType = (typeof MEDIA_TYPES)[number];

`src/components/language-toggle.tsx` · 39 ln · ← [code]/page, admin/layout, app-shell, desktop-sidebar, +5 · 2 commits/90d
  :8    export function LanguageToggle({ className }: { className?: string })
  :12   function toggleLanguage()

`src/lib/actions/groups.ts` · 467 ln · ← [code]/page, auth, blind-pick-toggle-form, groups/page, +3 · 9 commits/90d
  :17   export async function createGroup(formData: FormData): Promise<ActionResult<{ groupId: …
  :62   export async function joinGroupByCode(
  :95   export async function joinGroup(formData: FormData): Promise<ActionResult<{ groupId: st…
  :120  export async function joinGroupByCodeAction(code: string): Promise<ActionResult<{ group…
  :141  export type PublicGroupOverview =
  :157  export async function getGroupByInviteCode(
  :225  export async function autoJoinPendingInvite(
  :234  export async function setPendingInviteAction(code: string): Promise<ActionResult<void>>
  :245  export async function renameGroup(
  :275  export async function regenerateInviteCode(
  :308  export async function removeMember(
  :342  export async function leaveGroup(groupId: string): Promise<ActionResult<void>>
  ... +3 more symbols

`src/lib/actions/progress.ts` · 444 ln · ← [titleId]/page, add-to-shelf-dialog, adversarial-fuzzing.test, circle-title-progress, +4 · 5 commits/90d
  :23   export function toIsoDate(val?: string | null): string | null
  :38   function extractErrorMessage(err: unknown, fallback: string): string
  :49   export interface SaveMediaProgressInput
  :72   export async function getPersonalShelf(
  :99   export async function saveMediaProgress(
  :219  export async function updateProgressQuickStep(
  :265  export async function deleteMediaProgress(
  :292  export interface TitleMemberProgressItem
  :298  export async function getTitleCircleProgress(
  :389  export interface CircleLiveActivityItem
  :394  export async function getCircleLiveActivity(

`src/lib/i18n/types.ts` · 831 ln · ← auth-method-badges, client, en, i18n.test, +2 · 14 commits/90d
  :1    export type Locale = "tr" | "en";
  :3    export interface Translations

`src/components/spoiler-text.tsx` · 143 ln · ← [groupId]/page, activity/page, adversarial-spoilers-and-marginalia.test, comment-thread, +4 · 1 commit/90d
  :8    export interface SpoilerToken
  :13   export function parseSpoilerTokens(text: string): SpoilerToken[]
  :39   export function hasSpoilerTokens(text: string): boolean
  :44   interface SpoilerSpanProps
  :49   export function SpoilerSpan({ children, className }: SpoilerSpanProps)
  :117  export interface SpoilerTextProps
  :123  export function SpoilerText({ text, children, className }: SpoilerTextProps)

`src/lib/i18n/index.ts` · 56 ln · ← [code]/page, activity/page, client, comment-thread, +4 · 1 commit/90d
  :13   export const defaultLocale: Locale = "tr";
  :15   export function getTranslations(locale: Locale = defaultLocale): Translations
  :19   export const t = getTranslations("tr");
  :21   export function formatRelativeTime(

`src/lib/providers/types.ts` · 16 ln · ← add-title-form, add-to-shelf-dialog, google-books, itunes-podcasts, +4 · 1 commit/90d
  :3    export type NormalizedSearchResult =
  :12   export interface MediaProvider

`src/components/copy-invite-button.tsx` · 118 ln · ← [code]/page, [groupId]/page, groups/page, settings/page · 5 commits/90d
  :10   export function CopyInviteButton(
  :24   async function copy(e: React.MouseEvent)

`src/components/ui/textarea.tsx` · 19 ln · ← add-quote-dialog, add-to-shelf-dialog, comment-thread, edit-progress-dialog, +3 · 1 commit/90d
  :5    function Textarea({ className, ...props }: React.ComponentProps<"textarea">)

`src/lib/actions/marginalia.ts` · 425 ln · ← add-quote-dialog, adversarial-fuzzing.test, adversarial-spoilers-and-marginalia.test, marginalia.test, +3 · 1 commit/90d
  :19   export interface AddQuoteInput
  :29   export interface StructuredAttribution
  :37   export function parseTags(input: string | string[] | undefined | null): string[]
  :73   export function formatAttribution(
  :116  export function validateQuoteInput(input: AddQuoteInput):
  :182  export function canUserViewQuote(
  :206  export function canUserDeleteQuote(
  :217  export function filterQuotesForViewer<
  :224  export type QuoteExpand =
  :229  export async function addQuote(
  :277  export async function deleteQuote(quoteId: string): Promise<ActionResult<void>>
  :308  export async function getUserQuotes(
  ... +2 more symbols

`src/lib/flags/registry.ts` · 55 ln · ← actions, adversarial-flags-and-security.test, client, flags.test, +3 · 1 commit/90d
  :1    export type FeatureFlagKey =
  :9    export type FeatureFlagStage = "alpha" | "beta" | "experimental";
  :11   export interface FeatureFlagDefinition
  :17   export const FEATURE_FLAGS: Record<FeatureFlagKey, FeatureFlagDefinition> =
  :50   export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];
  :52   export function isKnownFeatureFlag(key: string): key is FeatureFlagKey

`src/lib/flags/server.ts` · 206 ln · ← actions, adversarial-flags-and-security.test, app/layout, flags.test, +3 · 1 commit/90d
  :5    type FeatureFlagKey,
  :8    export const FEATURE_FLAGS_COOKIE_NAME = "hepyeni_flags";
  :10   export interface FeatureFlagContext
  :24   function parseCookieFlags(cookieValue?: string): Partial<Record<FeatureFlagKey, boolean…
  :52   async function getCookieValue(
  :74   export async function isFeatureEnabled(
  :132  export async function getFeatureFlags(
  :197  export async function requireFeature(

`src/lib/actions/schedules.ts` · 604 ln · ← [groupId]/page, adversarial-spoilers-and-marginalia.test, group-content-view, group-schedules-card, +1 · 6 commits/90d
  :29   export interface MilestoneCommentItem
  :46   export interface MilestoneCommentsResult
  :53   function toIsoDate(val?: string | null): string | null
  :60   function extractErrorMessage(err: unknown, fallback: string): string
  :71   export interface CreateScheduleMilestoneInput
  :77   export interface CreateGroupScheduleInput
  :86   export interface MilestoneWithCheckins extends ScheduleMilestonesResponse
  :92   export interface GroupScheduleWithMilestones extends GroupSchedulesResponse
  :98   export async function getGroupSchedules(
  :196  export async function createGroupSchedule(
  :281  export async function updateGroupScheduleStatus(
  :307  export async function deleteGroupSchedule(
  ... +5 more symbols

`src/components/ui/alert-dialog.tsx` · 188 ln · ← comment-thread, confirm-action-button, edit-progress-dialog, group-schedules-card, +2 · 1 commit/90d
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

`src/lib/importers/index.ts` · 305 ln · ← adversarial-importers.test, exporters.test, import-dropzone, import-export-view, +2 · 1 commit/90d
  :18   export function detectImportSource(
  :74   function parseGenericCsv(content: string): NormalizedImportItem[]
  :190  function parseHepYeniJson(content: string): NormalizedImportItem[]
  :266  export function parseImportFile(content: string, filename?: string): ParseResult

`src/lib/actions/titles.ts` · 260 ln · ← [groupId]/page, [titleId]/page, add-title-form · 12 commits/90d
  :15   export type SearchTitlesResponse =
  :22   export interface AddTitleOptions
  :27   export async function searchTitles(
  :59   export async function addTitle(
  :128  export type CustomTitleInput =
  :137  export async function addCustomTitle(
  :205  export async function markConsumed(
  :233  export async function unmarkConsumed(

`src/components/ui/label.tsx` · 21 ln · ← add-quote-dialog, add-to-shelf-dialog, edit-progress-dialog, group-schedules-card, +1 · 1 commit/90d
  :7    function Label({ className, ...props }: React.ComponentProps<"label">)

`src/lib/importers/types.ts` · 36 ln · ← goodreads, import-export, importers/index, letterboxd, +1 · 1 commit/90d
  :7    export type ImportSource =
  :14   export interface NormalizedImportItem
  :31   export interface ParseResult

`src/app/groups/[groupId]/add/add-title-form.tsx` · 512 ln · ← add-title-dialog, add/page · 10 commits/90d
  :24   interface AddTitleFormProps
  :30   export function AddTitleForm(
  :56   function handleSearch(e: React.FormEvent)
  :86   function handleAdd(result: NormalizedSearchResult)
  :111  function handleAddCustom(e: React.FormEvent)

`src/components/empty-state.tsx` · 41 ln · ← activity/page, add-title-form, group-content-view, groups/page · 2 commits/90d
  :4    export function EmptyState(

`src/components/vote-control.tsx` · 170 ln · ← group-content-view, landing-view, title-detail-view · 6 commits/90d
  :11   type VoteValue = "up" | "down";
  :12   type VoteState = { score: number; userVote?: VoteValue };
  :14   export function VoteControl(
  :42   function vote(value: VoteValue)

`src/lib/comments.ts` · 79 ln · ← adversarial-fuzzing.test, comment-thread, comments, comments.test · 2 commits/90d
  :1    export function validateCommentContent(raw: unknown): string
  :20   export function canDeleteComment(
  :38   export type CommentNode<T> = T &
  :42   export function organizeCommentsTree<

`src/components/confirm-action-button.tsx` · 106 ln · ← profile/page, quote-card, settings/page · 5 commits/90d
  :21   export function ConfirmActionButton(

`src/lib/actions/comments.ts` · 150 ln · ← [groupId]/page, [titleId]/page, comment-thread · 5 commits/90d
  :13   export async function addComment(
  :78   export async function getComments(
  :104  export async function deleteComment(

`src/lib/importers/csv-parser.ts` · 200 ln · ← goodreads, importers/index, letterboxd, storygraph · 1 commit/90d
  :11   export function parseCsv(text: string, delimiter = ","): string[][]
  :100  export interface CsvTable
  :106  export function normalizeHeaderKey(key: string): string
  :111  export function parseCsvToTable(text: string): CsvTable
  :149  export function getField(row: Record<string, string>, ...possibleKeys: string[]): strin…
  :163  export function parseSafeDate(dateStr?: string | null): string | undefined

`src/lib/pocketbase/vote-id.ts` · 35 ln · ← adversarial-flags-and-security.test, adversarial-fuzzing.test, vote-id.test, votes · 1 commit/90d
  :9    export async function voteRecordId(

`src/lib/providers/index.ts` · 27 ln · ← add-title-form, providers.test, search/route, titles · 1 commit/90d
  :16   export function getProvider(mediaType: MediaType): MediaProvider
  :24   export function isProviderAvailable(mediaType: MediaType): boolean

`src/app/groups/[groupId]/page.tsx` · 322 ln · 15 commits/90d · entry point
  :28   type TitleExpand =
  :34   export default async function GroupPage(
  :136  async function handleVote(titleId: string, value: "up" | "down")
  :141  async function handleMarkConsumed(titleId: string)
  :146  async function handleUnmarkConsumed(titleId: string)
  :151  async function handleSubmitReview(titleId: string, formData: FormData)
  :156  async function handleAddComment(titleId: string, formData: FormData)
  :161  async function handleDeleteComment(commentId: string)
  :166  async function handleGetComments(titleId: string)

`src/app/groups/page.tsx` · 178 ln · 11 commits/90d · entry point
  :21   export default async function GroupsPage()

`src/app/login/page.tsx` · 293 ln · 12 commits/90d · entry point
  :32   export default async function LoginPage(

`src/app/profile/page.tsx` · 240 ln · 10 commits/90d · entry point
  :24   export default async function ProfilePage()

`src/lib/actions/admin.ts` · 190 ln · ← [groupId]/page, groups/page, users/page · 4 commits/90d
  :15   async function requireCallerAdmin()
  :22   export async function setUserAdmin(
  :43   export async function banUser(userId: string): Promise<ActionResult<void>>
  :63   export async function unbanUser(userId: string): Promise<ActionResult<void>>
  :78   export async function adminDeleteGroup(groupId: string): Promise<ActionResult<void>>
  :93   export async function adminDeleteTitle(
  :123  export async function adminDeleteReview(
  :158  export async function adminRemoveGroupMember(

`src/app/groups/[groupId]/settings/page.tsx` · 319 ln · 9 commits/90d · entry point
  :30   export default async function GroupSettingsPage(

`src/components/mark-consumed-button.tsx` · 68 ln · ← group-content-view, title-detail-view · 6 commits/90d
  :11   export function MarkConsumedButton(

`src/lib/actions/reviews.ts` · 65 ln · ← [groupId]/page, [titleId]/page · 6 commits/90d
  :11   export async function submitReview(

`src/lib/actions/votes.ts` · 67 ln · ← [groupId]/page, [titleId]/page · 6 commits/90d
  :13   export async function voteOnTitle(

`src/app/activity/page.tsx` · 360 ln · 7 commits/90d · entry point
  :26   type ActivityItem =
  :49   export default async function ActivityPage()

`src/app/admin/groups/[groupId]/page.tsx` · 252 ln · 7 commits/90d · entry point
  :27   type TitleExpand =
  :33   export default async function AdminGroupDetailPage(

`src/app/admin/users/page.tsx` · 133 ln · 7 commits/90d · entry point
  :14   export default async function AdminUsersPage()

`src/app/layout.tsx` · 71 ln · 7 commits/90d · entry point
  :21   export async function generateMetadata(): Promise<Metadata>
  :29   export const viewport =
  :34   export default async function RootLayout({ children }: LayoutProps<"/">)

`src/app/shelf/add-to-shelf-dialog.tsx` · 459 ln · ← circle-title-progress, shelf-view · 5 commits/90d
  :34   export function AddToShelfDialog()

`src/app/shelf/edit-progress-dialog.tsx` · 400 ln · ← circle-title-progress, shelf-view · 5 commits/90d
  :41   interface EditProgressDialogProps
  :47   export function EditProgressDialog(

`src/components/mood-selector.tsx` · 149 ln · ← add-title-form, add-to-shelf-dialog, edit-progress-dialog · 1 commit/90d
  :9    type MoodType,
  :10   type PaceType,
  :16   export interface MoodSelectorProps
  :26   export function MoodSelector(

`src/components/review-form.tsx` · 96 ln · ← group-content-view, title-detail-view · 5 commits/90d
  :12   export function ReviewForm(
  :28   function handleSubmit(e: React.FormEvent<HTMLFormElement>)

`src/lib/exporters/zip.ts` · 142 ln · ← exporters/index, import-export, markdown-exporter · 1 commit/90d
  :15   export function calculateCrc32(data: Uint8Array): number
  :23   export interface ZipFileInput
  :28   export function createZipArchive(files: ZipFileInput[]): Uint8Array
  :132  export function uint8ArrayToBase64(bytes: Uint8Array): string

`src/lib/providers/google-books.ts` · 178 ln · ← providers.test, providers/index · 5 commits/90d
  :4    type GoogleBooksItem =
  :16   type ItunesEbookResult =
  :25   type OpenLibraryDoc =
  :34   async function searchItunesBooks(query: string): Promise<NormalizedSearchResult[]>
  :66   async function searchOpenLibrary(query: string): Promise<NormalizedSearchResult[]>
  :103  export const googleBooksProvider: MediaProvider =

`src/app/admin/groups/page.tsx` · 138 ln · 6 commits/90d · entry point
  :17   export default async function AdminGroupsPage()

`src/app/admin/layout.tsx` · 80 ln · 6 commits/90d · entry point
  :11   export default async function AdminLayout(

`src/app/api/auth/oauth2-callback/route.ts` · 97 ln · 6 commits/90d · entry point
  :13   async function handleCallback(
  :79   export async function GET(req: NextRequest)
  :89   export async function POST(req: NextRequest)

`src/components/comment-thread.tsx` · 548 ln · ← media-comments, title-detail-view · 4 commits/90d
  :30   export type OptimisticComment =
  :39   export type DisplayComment =
  :43   export interface CommentThreadProps
  :66   export function CommentThread(
  :122  async function handleAddComment(e: React.FormEvent<HTMLFormElement>)
  :188  function handleDeleteComment(commentId: string)
  :216  function handleStartReply(commentId: string, authorName: string)
  :223  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>)

`src/app/admin/page.tsx` · 136 ln · 5 commits/90d · entry point
  :8    export default async function AdminDashboardPage()

`src/app/groups/[groupId]/add/page.tsx` · 69 ln · 5 commits/90d · entry point
  :9    export default async function AddTitlePage(

`src/components/add-title-dialog.tsx` · 78 ln · ← [groupId]/page, group-content-view · 3 commits/90d
  :17   interface AddTitleDialogProps
  :25   export function AddTitleDialog(
  :38   function handleSuccess()

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

`src/app/groups/[groupId]/titles/[titleId]/page.tsx` · 179 ln · 4 commits/90d · entry point
  :22   type TitleExpand =
  :28   export default async function TitleDetailPage(
  :109  async function handleVote(value: "up" | "down")
  :114  async function handleMarkConsumed()
  :119  async function handleUnmarkConsumed()
  :124  async function handleSubmitReview(formData: FormData)
  :129  async function handleAddComment(targetTitleId: string, formData: FormData)
  :134  async function handleDeleteComment(commentId: string)
  :139  async function handleGetComments(targetTitleId: string)

`src/app/reset-password/page.tsx` · 109 ln · 4 commits/90d · entry point
  :10   export default async function ResetPasswordPage(

`src/lib/admin.ts` · 10 ln · ← admin, admin/layout · 2 commits/90d
  :4    export async function requireAdmin(userId: string): Promise<UsersResponse>

`src/lib/providers/itunes-podcasts.ts` · 39 ln · ← providers.test, providers/index · 2 commits/90d
  :3    type ItunesResult =
  :11   export const itunesPodcastProvider: MediaProvider =

`src/app/page.tsx` · 31 ln · 3 commits/90d · entry point
  :6    export default async function Home()

`src/lib/actions/import-export.ts` · 265 ln · ← export-card, import-preview-table · 1 commit/90d
  :15   export interface BatchImportResult
  :20   export interface ExportResult
  :27   function normalizeTitleKey(title: string): string
  :34   function toIsoDate(val?: string | null): string | null
  :41   export async function batchImportProgress(
  :196  export async function exportShelfData(

`src/lib/exporters/csv-exporter.ts` · 58 ln · ← exporters/index, import-export · 1 commit/90d
  :3    function escapeCsvField(val: unknown): string
  :12   export function exportShelfToCsv(items: UserMediaProgressResponse[]): string

`src/lib/exporters/json-exporter.ts` · 22 ln · ← exporters/index, import-export · 1 commit/90d
  :3    export interface ShelfJsonExport
  :11   export function exportShelfToJson(items: UserMediaProgressResponse[]): string

`src/lib/exporters/markdown-exporter.ts` · 149 ln · ← exporters/index, import-export · 1 commit/90d
  :4    function sanitizeFilename(name: string): string
  :12   function escapeYamlString(val: string): string
  :19   export function generateItemMarkdown(item: UserMediaProgressResponse):
  :84   export function exportShelfToMarkdownZip(items: UserMediaProgressResponse[]): Uint8Array
  :142  export function exportShelfToSingleMarkdown(items: UserMediaProgressResponse[]): string

`src/lib/flags/actions.ts` · 65 ln · ← flags/index, labs-card · 1 commit/90d
  :10   export async function toggleUserFeatureFlag(

`src/lib/invite-code.ts` · 7 ln · ← groups, invite-code.test · 1 commit/90d
  :3    export function generateInviteCode(length = 8): string

`src/app/privacy/page.tsx` · 194 ln · 2 commits/90d · entry point
  :9    export const metadata: Metadata =
  :14   export default function PrivacyPolicyPage()

`src/app/shelf/page.tsx` · 49 ln · 2 commits/90d · entry point
  :12   export default async function ShelfPage()

`src/app/terms/page.tsx` · 162 ln · 2 commits/90d · entry point
  :8    export const metadata: Metadata =
  :13   export default function TermsOfServicePage()

`src/app/api/titles/search/route.ts` · 53 ln · 1 commit/90d · entry point
  :8    export async function GET(req: NextRequest)

`src/app/invite/[code]/page.tsx` · 215 ln · 1 commit/90d · entry point
  :23   export default async function InvitePage(

`src/app/invite/page.tsx` · 80 ln · 1 commit/90d · entry point
  :11   export default async function InviteRootPage(

`src/app/shelf/import-export/page.tsx` · 37 ln · 1 commit/90d · entry point
  :9    export default async function ImportExportPage()

## Supporting files

`src/app/groups/[groupId]/group-content-view.tsx` · 936 ln · ← [groupId]/page · 14 commits/90d · :40 type TitleWithScore = TitlesResponse< · :51 interface GroupContentViewProps · :87 export function GroupContentView

`src/components/layout/desktop-sidebar.tsx` · 169 ln · ← app-shell · 7 commits/90d · :15 interface DesktopSidebarProps · :25 export function DesktopSidebar

`src/components/media-comments.tsx` · 127 ln · ← group-content-view · 7 commits/90d · :23 interface MediaCommentsProps · :46 export function MediaComments

`src/components/group-forms.tsx` · 173 ln · ← groups/page · 6 commits/90d · :13 function errorMessage · :17 export function CreateGroupCard · :26 function handleSubmit · :95 export function JoinGroupCard · :104 function handleSubmit

`src/proxy.ts` · 46 ln · 11 commits/90d · :9 export default async function proxy · :37 export const config =

`src/app/groups/[groupId]/titles/[titleId]/title-detail-view.tsx` · 560 ln · ← [titleId]/page · 5 commits/90d · :46 type TitleWithScore = TitlesResponse< · :55 interface TitleDetailViewProps · :86 export function TitleDetailView · :150 async function handleCopyLink

`src/app/shelf/shelf-view.tsx` · 385 ln · ← shelf/page · 5 commits/90d · :39 interface ShelfViewProps · :49 export function ShelfView

`src/components/bottom-nav.tsx` · 53 ln · ← app-shell · 5 commits/90d · :9 export function BottomNav

`src/components/group-schedules-card.tsx` · 631 ln · ← group-content-view · 4 commits/90d · :47 type GroupScheduleWithMilestones, · :48 type MilestoneWithCheckins, · :55 interface GroupSchedulesCardProps · :64 export function GroupSchedulesCard

`src/lib/actions/profile.ts` · 60 ln · ← profile/page · 4 commits/90d · :10 export async function updateProfileName · :35 export async function deleteAccount

`src/components/forgot-password-form.tsx` · 40 ln · ← login/page · 3 commits/90d · :9 export function ForgotPasswordForm · :22 function handleSubmit

`src/components/send-reset-link-button.tsx` · 32 ln · ← profile/page · 3 commits/90d · :8 export function SendResetLinkButton

`src/app/groups/[groupId]/settings/guest-settings-form.tsx` · 339 ln · ← settings/page · 2 commits/90d · :28 interface GuestSettingsFormProps · :34 export function GuestSettingsForm

`src/app/landing-view.tsx` · 566 ln · ← app/page · 2 commits/90d · :35 interface LandingViewProps · :44 export function LandingView

`src/app/groups/[groupId]/settings/blind-pick-toggle-form.tsx` · 116 ln · ← settings/page · 1 commit/90d · :19 interface BlindPickToggleFormProps · :24 export function BlindPickToggleForm

`src/app/invite/[code]/invite-cta.tsx` · 123 ln · ← [code]/page · 1 commit/90d · :15 export function InviteCTA · :30 async function handleDirectJoin · :42 async function handleAuthRedirect

`src/app/invite/enter-code-form.tsx` · 63 ln · ← invite/page · 1 commit/90d · :10 export function EnterCodeForm

`src/app/shelf/import-export/export-card.tsx` · 166 ln · ← import-export-view · 1 commit/90d · :20 export function ExportCard

`src/app/shelf/import-export/import-dropzone.tsx` · 243 ln · ← import-export-view · 1 commit/90d · :11 interface ImportDropzoneProps · :24 export function ImportDropzone

`src/app/shelf/import-export/import-export-view.tsx` · 118 ln · ← import-export/page · 1 commit/90d · :14 export function ImportExportView

`src/app/shelf/import-export/import-preview-table.tsx` · 453 ln · ← import-export-view · 1 commit/90d · :42 interface ImportPreviewTableProps · :49 export function ImportPreviewTable

`src/app/shelf/quotes-tab.tsx` · 217 ln · ← shelf-view · 1 commit/90d · :19 interface QuotesTabProps · :29 export function QuotesTab

`src/components/add-quote-dialog.tsx` · 306 ln · ← quotes-tab · 1 commit/90d · :22 interface AddQuoteDialogProps · :33 export function AddQuoteDialog

`src/components/auth-method-badges.tsx` · 224 ln · ← profile/page · 1 commit/90d · :7 export function GoogleIcon · :30 export function AppleIcon · :38 export function PasswordIcon · :42 export function EmailOtpIcon · :46 export interface AuthMethodHeaderBadgesProps · :51 export function AuthMethodHeaderBadges

`src/components/circle-title-progress.tsx` · 173 ln · ← title-detail-view · 1 commit/90d · :17 interface CircleTitleProgressProps · :24 export function CircleTitleProgress

`src/components/decision-wheel-dialog.tsx` · 317 ln · ← group-content-view · 1 commit/90d · :38 interface TitleItem extends Partial<TitlesResponse> · :47 export interface DecisionWheelDialogProps · :56 export function DecisionWheelDialog

`src/components/diagnostic-modal.tsx` · 190 ln · ← profile/page · 1 commit/90d · :27 export function DiagnosticModal · :38 async function loadDiagnostics · :50 async function copyReport

`src/components/labs-card.tsx` · 154 ln · ← profile/page · 1 commit/90d · :15 export function LabsCard

`src/components/milestone-campfire-dialog.tsx` · 431 ln · ← group-schedules-card · 1 commit/90d · :44 type MilestoneCommentItem, · :45 type MilestoneWithCheckins, · :52 interface MilestoneCampfireDialogProps · :65 export function MilestoneCampfireDialog

`src/components/quote-card.tsx` · 184 ln · ← quotes-tab · 1 commit/90d · :20 interface QuoteCardProps · :30 export function QuoteCard

`src/components/theme-provider.tsx` · 12 ln · ← app/layout · 1 commit/90d · :6 export function ThemeProvider

`src/components/ui/separator.tsx` · 26 ln · ← login/page · 1 commit/90d · :7 function Separator

`src/components/ui/switch.tsx` · 31 ln · ← labs-card · 1 commit/90d · :7 function Switch

`src/components/ui/tabs.tsx` · 83 ln · ← login/page · 1 commit/90d · :8 function Tabs · :41 function TabsList · :56 function TabsTrigger · :72 function TabsContent

`src/lib/actions/diagnostics.ts` · 12 ln · ← diagnostic-modal · 1 commit/90d · :6 export async function getDiagnosticsAction

`src/lib/importers/goodreads.ts` · 65 ln · ← importers/index · 1 commit/90d · :5 export function parseGoodreadsCsv

`src/lib/importers/letterboxd.ts` · 56 ln · ← importers/index · 1 commit/90d · :5 export function parseLetterboxdCsv

`src/lib/importers/storygraph.ts` · 67 ln · ← importers/index · 1 commit/90d · :5 export function parseStoryGraphCsv

`src/app/error.tsx` · 99 ln · 2 commits/90d · :9 export default function RootError

`src/app/global-error.tsx` · 83 ln · 2 commits/90d · :6 export default function GlobalError

`tests/comments.test.ts` · 196 ln · 2 commits/90d · :186 function resolveParentId

`tests/guest-management.test.ts` · 335 ln · 2 commits/90d · :11 function createMockGroup · :27 function createMockMembership

`src/app/shelf/error.tsx` · 58 ln · 1 commit/90d · :9 export default function ShelfError

`src/components/ui/skeleton.tsx` · 14 ln · 1 commit/90d · :3 function Skeleton

`tests/auth-methods.test.ts` · 110 ln · 1 commit/90d · :57 function extractAuthMethods

`tests/flags.test.ts` · 213 ln · 1 commit/90d · :6 type FeatureFlagKey,

`tests/i18n-exhaustive.test.ts` · 69 ln · 1 commit/90d · :6 function compareObjects · :54 function assertNoEmptyStrings

`tests/i18n.test.ts` · 119 ln · 1 commit/90d · :36 function secondsAgo

`tests/marginalia.test.ts` · 310 ln · 1 commit/90d · :11 type AddQuoteInput,

`tests/moods-and-wheel.test.ts` · 387 ln · 1 commit/90d · :15 type MoodType, · :16 type PaceType,

`tests/progress.test.ts` · 117 ln · 1 commit/90d · :9 function calculateProgressPercentage · :22 function applyQuickStep · :34 function filterCircleVisibleProgress

`tests/schedules.test.ts` · 129 ln · 1 commit/90d · :5 function calculateMilestoneCompletionRate · :13 function orderMilestones<T extends { orderIndex?: number; targetDate?: string }>

`tests/adversarial-flags-and-security.test.ts` · 329 ln · :11 type FeatureFlagKey,

`tests/adversarial-fuzzing.test.ts` · 544 ln · :7 type AddQuoteInput,

## Other files

- `.` — 19 files ((no ext), .example, .json, .lock)
- `.agents/` — 4 files (.jsonl, .md)
- `.github/workflows/` — `deploy.yml`
- `docs/` — 7 files (.md)
- `pb_migrations/` — 8 files (.js)
- `public/` — 5 files (.svg)
- `src/app/` — `globals.css`, `favicon.ico`
- `src/components/ui/` — `sonner.tsx`
- `src/lib/exporters/` — `index.ts`
- `src/lib/flags/` — `index.ts`
- `tests/` — 19 files (.ts)

_Detailed 155 of 223 files; 68 collapsed above._