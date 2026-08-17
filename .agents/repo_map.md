# Repository Map

Total mapped files: 158

- `.agents/activity.jsonl` (12492 B)
- `.agents/decisions.md` (7222 B)
- `.agents/memory.md` (4925 B)
- `.agents/repo_map.md` (16640 B)
- `.claude/RESUME.md` (694 B)
- `.dockerignore` (58 B)
- `.env.example` (738 B)
- `.env.local` (406 B)
- `.github/workflows/deploy.yml` (6851 B)
- `.gitignore` (639 B)
- `AGENTS.md` (678 B)
- `CLAUDE.md` (678 B)
- `DECISIONS.md` (5686 B)
- `Dockerfile` (1467 B)
- `Dockerfile.pocketbase` (902 B)
- `README.md` (5853 B)
- `bun.lock` (168666 B)
- `components.json` (520 B)
- `docker-compose.yml` (610 B)
- `docs/ARCHITECTURE.md` (10961 B)
- `docs/AUTH_AND_SECURITY.md` (9314 B)
- `docs/CODEBASE_MAP.md` (19583 B)
- `docs/DATA_MODELS.md` (9581 B)
- `docs/DEPLOYMENT_AND_INFRA.md` (8669 B)
- `docs/EXTERNAL_APIS.md` (5032 B)
- `docs/README.md` (12494 B)
- `eslint.config.mjs` (716 B)
- `next.config.ts` (129 B)
    * const nextConfig
- `package.json` (1122 B)
- `pb_migrations/1755280800_initial_schema.js` (7223 B)
    * const users
    * const groups
    * const groupMembers
    * const titles
    * const votes
    * const reviews
- `pb_migrations/1755280900_comments_schema.js` (1407 B)
    * const users
    * const groups
    * const titles
    * const comments
    * const collection
- `pb_migrations/1755281000_comment_replies_schema.js` (862 B)
    * const comments
    * const existingField
    * const comments
    * const existingField
- `pb_migrations/1755281100_group_guest_settings_schema.js` (909 B)
    * const groups
    * const isPublicField
    * const guestSettingsField
    * const groups
- `plan.md` (3119 B)
- `postcss.config.mjs` (94 B)
- `public/file.svg` (391 B)
- `public/globe.svg` (1035 B)
- `public/next.svg` (1375 B)
- `public/vercel.svg` (128 B)
- `public/window.svg` (385 B)
- `src/app/activity/page.tsx` (15588 B)
    * type ActivityItem
    * const session
    * const pb
    * const t
    * const locale
    * const groupIds
- `src/app/admin/groups/[groupId]/page.tsx` (9751 B)
    * type TitleExpand
    * const pb
    * const t
    * const votes
    * const reviews
    * const score
- `src/app/admin/groups/page.tsx` (5303 B)
    * const pb
    * const t
    * const groups
    * const countBy
    * const counts
    * const membersPerGroup
- `src/app/admin/layout.tsx` (2980 B)
    * const session
    * const t
- `src/app/admin/page.tsx` (5571 B)
    * const pb
    * const t
    * const stats
    * const Icon
- `src/app/admin/users/page.tsx` (5197 B)
    * const session
    * const pb
    * const allUsers
    * const t
    * const locale
    * const isSelf
- `src/app/api/auth/oauth2-callback/route.ts` (2765 B)
    * const origin
    * const redirectUri
    * const deny
    * const stored
    * const diag
    * const pb
- `src/app/api/titles/search/route.ts` (1522 B)
    * const token
    * const session
    * const mediaType
    * const query
    * const results
    * const diag
- `src/app/error.tsx` (2458 B)
- `src/app/favicon.ico` (25931 B)
- `src/app/global-error.tsx` (1829 B)
- `src/app/globals.css` (4355 B)
- `src/app/groups/[groupId]/add/add-title-form.tsx` (18845 B)
    * interface AddTitleFormProps
    * export function AddTitleForm
    * const router
    * const t
    * function handleSearch
    * const cleanQuery
- `src/app/groups/[groupId]/add/page.tsx` (2006 B)
    * const session
    * const pb
    * const userRecord
    * const currentUser
- `src/app/groups/[groupId]/group-content-view.tsx` (33561 B)
    * type TitleWithScore
    * interface GroupContentViewProps
    * export function GroupContentView
    * const defaultTab
    * const t
    * const currentList
- `src/app/groups/[groupId]/page.tsx` (10789 B)
    * type TitleExpand
    * const session
    * const t
    * const group
    * const pb
    * const commentCounts
- `src/app/groups/[groupId]/settings/guest-settings-form.tsx` (12834 B)
    * interface GuestSettingsFormProps
    * export function GuestSettingsForm
    * const t
    * const handleCopyLink
    * const publicUrl
    * const handleSave
- `src/app/groups/[groupId]/settings/page.tsx` (12344 B)
    * const session
    * const pb
    * const t
    * const isOwner
    * const currentUser
    * const userName
- `src/app/groups/[groupId]/titles/[titleId]/page.tsx` (4911 B)
    * type TitleExpand
    * const session
    * const t
    * const group
    * const pb
    * const votes
- `src/app/groups/[groupId]/titles/[titleId]/title-detail-view.tsx` (21125 B)
    * type TitleWithScore
    * interface TitleDetailViewProps
    * export function TitleDetailView
    * const defaultTab
    * const t
    * const locale
- `src/app/groups/page.tsx` (7600 B)
    * const session
    * const t
    * const pb
    * const groupIds
    * const filterParams
    * const filterExpr
- `src/app/invite/[code]/invite-cta.tsx` (3362 B)
    * export function InviteCTA
    * const router
    * const t
    * const joinedId
- `src/app/invite/[code]/page.tsx` (8639 B)
- `src/app/landing-view.tsx` (24046 B)
    * interface LandingViewProps
    * export function LandingView
    * const t
    * const locale
    * const mediaTypes
    * const Icon
- `src/app/layout.tsx` (1445 B)
    * const geistSans
    * const geistMono
    * const t
    * export const viewport
    * const locale
- `src/app/login/page.tsx` (13576 B)
    * const session
    * const ERROR_MESSAGES
    * const NOTICE_MESSAGES
- `src/app/page.tsx` (832 B)
    * const session
    * const pb
    * const currentUser
- `src/app/privacy/page.tsx` (10981 B)
    * export const metadata
    * const lastUpdated
- `src/app/profile/page.tsx` (9681 B)
    * const session
    * const pb
    * const currentUser
- `src/app/reset-password/page.tsx` (4589 B)
    * const t
    * const ERROR_MESSAGES
- `src/app/terms/page.tsx` (8598 B)
    * export const metadata
    * const lastUpdated
- `src/components/add-title-dialog.tsx` (2278 B)
    * interface AddTitleDialogProps
    * export function AddTitleDialog
    * const t
    * const isControlled
    * const open
    * const setOpen
- `src/components/auth-method-badges.tsx` (8446 B)
    * export function GoogleIcon
    * export function AppleIcon
    * export function PasswordIcon
    * export function EmailOtpIcon
    * export interface AuthMethodHeaderBadgesProps
    * export function AuthMethodHeaderBadges
- `src/components/bottom-nav.tsx` (1923 B)
    * export function BottomNav
    * const pathname
    * const t
    * const tabs
    * const active
- `src/components/comment-thread.tsx` (20611 B)
    * export type OptimisticComment
    * export type DisplayComment
    * export interface CommentThreadProps
    * export function CommentThread
    * const formRef
    * const textareaRef
- `src/components/confirm-action-button.tsx` (2931 B)
    * export function ConfirmActionButton
    * const router
    * const t
    * const resolvedConfirmLabel
    * const resolvedPendingLabel
- `src/components/copy-invite-button.tsx` (2896 B)
    * export function CopyInviteButton
    * const t
    * const textToCopy
    * const label
- `src/components/diagnostic-modal.tsx` (6664 B)
    * export function DiagnosticModal
    * const t
    * const items
    * const report
- `src/components/empty-state.tsx` (1122 B)
    * export function EmptyState
- `src/components/forgot-password-form.tsx` (1179 B)
    * export function ForgotPasswordForm
    * const t
    * function handleSubmit
    * const formData
- `src/components/group-forms.tsx` (4838 B)
    * function errorMessage
    * export function CreateGroupCard
    * const router
    * const t
    * function handleSubmit
    * const form
- `src/components/inline-text-form.tsx` (1498 B)
    * export function InlineTextForm
    * const t
    * const resolvedSubmitLabel
    * const resolvedPendingLabel
    * function handleSubmit
    * const formData
- `src/components/language-toggle.tsx` (1254 B)
    * export function LanguageToggle
    * const router
    * function toggleLanguage
    * const nextLocale
- `src/components/layout/app-shell.tsx` (3981 B)
    * interface AppShellProps
    * export function AppShell
    * const t
    * const resolvedBackLabel
    * const widthClasses
- `src/components/layout/desktop-sidebar.tsx` (5646 B)
    * interface DesktopSidebarProps
    * export function DesktopSidebar
    * const pathname
    * const t
    * const navItems
    * const userInitials
- `src/components/mark-consumed-button.tsx` (1725 B)
    * export function MarkConsumedButton
    * const t
    * const label
    * const errorMessage
    * const Icon
- `src/components/media-badge.tsx` (1775 B)
    * interface MediaBadgeProps
    * const MEDIA_ICONS
    * const MEDIA_STYLES
    * export function MediaBadge
    * const t
    * const Icon
- `src/components/media-comments.tsx` (3758 B)
    * interface MediaCommentsProps
    * export function MediaComments
    * const t
- `src/components/media-cover.tsx` (1465 B)
    * const SIZES
    * export function MediaCover
    * const sizeClass
- `src/components/review-form.tsx` (2748 B)
    * export function ReviewForm
    * const t
    * function handleSubmit
    * const formData
    * const shown
- `src/components/send-reset-link-button.tsx` (903 B)
    * export function SendResetLinkButton
    * const t
    * const formData
- `src/components/theme-provider.tsx` (306 B)
    * export function ThemeProvider
- `src/components/theme-toggle.tsx` (1285 B)
    * const emptySubscribe
    * export function ThemeToggle
    * const mounted
    * const isDark
- `src/components/ui/alert-dialog.tsx` (5272 B)
    * function AlertDialog
    * function AlertDialogTrigger
    * function AlertDialogPortal
    * function AlertDialogOverlay
    * function AlertDialogContent
    * function AlertDialogHeader
- `src/components/ui/avatar.tsx` (3038 B)
    * function Avatar
    * function AvatarImage
    * function AvatarFallback
    * function AvatarBadge
    * function AvatarGroup
    * function AvatarGroupCount
- `src/components/ui/badge.tsx` (1925 B)
    * const badgeVariants
    * function Badge
- `src/components/ui/button.tsx` (3240 B)
    * const buttonVariants
    * function Button
- `src/components/ui/card.tsx` (2630 B)
    * function Card
    * function CardHeader
    * function CardTitle
    * function CardDescription
    * function CardAction
    * function CardContent
- `src/components/ui/dialog.tsx` (4075 B)
    * function Dialog
    * function DialogTrigger
    * function DialogPortal
    * function DialogClose
    * function DialogOverlay
    * function DialogContent
- `src/components/ui/input.tsx` (1040 B)
    * function Input
- `src/components/ui/label.tsx` (518 B)
    * function Label
- `src/components/ui/separator.tsx` (545 B)
    * function Separator
- `src/components/ui/skeleton.tsx` (275 B)
    * function Skeleton
- `src/components/ui/sonner.tsx` (1226 B)
    * const Toaster
- `src/components/ui/tabs.tsx` (3497 B)
    * function Tabs
    * const tabsListVariants
    * function TabsList
    * function TabsTrigger
    * function TabsContent
- `src/components/ui/textarea.tsx` (842 B)
    * function Textarea
- `src/components/vote-control.tsx` (5078 B)
    * type VoteValue
    * type VoteState
    * export function VoteControl
    * const t
    * const effectiveDisabled
    * const delta
- `src/lib/actions/admin.ts` (4253 B)
    * const session
    * const callerId
    * const pb
    * const callerId
    * const pb
    * const pb
- `src/lib/actions/auth.ts` (9150 B)
    * export type UserAuthMethods
    * const pb
    * const externalAuths
    * const oauthProviders
    * const pb
    * const methods
- `src/lib/actions/comments.ts` (3993 B)
    * const session
    * const access
    * const rawContent
    * const content
    * const pb
    * const rawParentId
- `src/lib/actions/diagnostics.ts` (429 B)
    * const session
- `src/lib/actions/groups.ts` (10850 B)
    * const session
    * const name
    * const pb
    * const cleanCode
    * const pb
    * const session
- `src/lib/actions/profile.ts` (1878 B)
    * const session
    * const name
    * const pb
    * const session
    * const pb
- `src/lib/actions/reviews.ts` (1732 B)
    * const session
    * const access
    * const rating
    * const rawReview
    * const reviewText
    * const pb
- `src/lib/actions/titles.ts` (6699 B)
    * export type SearchTitlesResponse
    * const session
    * const cleanQuery
    * const results
    * const diag
    * const session
- `src/lib/actions/votes.ts` (2380 B)
    * const session
    * const access
    * const pb
    * const id
    * const existing
- `src/lib/admin.ts` (402 B)
    * const pb
    * const user
- `src/lib/comments.ts` (2033 B)
    * export function validateCommentContent
    * const content
    * export function canDeleteComment
    * export type CommentNode
    * export function organizeCommentsTree
    * const rootComments
- `src/lib/errors/index.ts` (2397 B)
    * export type DiagnosticEntry
    * const MAX_DIAGNOSTICS
    * const diagnosticHistory
    * export function generateTraceId
    * const chars
    * export class AppError
- `src/lib/format.ts` (301 B)
    * export function getInitials
    * const source
    * export function getDisplayName
- `src/lib/i18n/client.tsx` (1318 B)
    * interface I18nContextType
    * const I18nContext
    * export function I18nProvider
    * const t
    * const setLocale
    * export function useI18n
- `src/lib/i18n/en.ts` (23503 B)
    * export const en
- `src/lib/i18n/index.ts` (1744 B)
    * const dictionaries
    * export const defaultLocale
    * export function getTranslations
    * export const t
    * export function formatRelativeTime
    * const date
- `src/lib/i18n/server.ts` (563 B)
    * const cookieStore
    * const localeCookie
    * const locale
    * const locale
- `src/lib/i18n/tr.ts` (25846 B)
    * export const tr
- `src/lib/i18n/types.ts` (13251 B)
    * export type Locale
    * export interface Translations
- `src/lib/invite-code.ts` (263 B)
    * const CHARSET
    * export function generateInviteCode
    * const bytes
- `src/lib/media-types.ts` (137 B)
    * export const MEDIA_TYPES
    * export type MediaType
- `src/lib/membership.ts` (5789 B)
    * export interface CircleAccess
    * export const DEFAULT_GUEST_SETTINGS
    * export function evaluateCircleAccess
    * const isPublic
    * const settings
    * const pb
- `src/lib/providers/google-books.ts` (5430 B)
    * type GoogleBooksItem
    * type ItunesEbookResult
    * type OpenLibraryDoc
    * const url
    * const res
    * const data
- `src/lib/providers/index.ts` (868 B)
    * const providers
    * export function getProvider
    * const provider
    * export function isProviderAvailable
- `src/lib/providers/itunes-podcasts.ts` (1148 B)
    * type ItunesResult
    * export const itunesPodcastProvider
    * const url
    * const res
    * const data
- `src/lib/providers/spotify.ts` (4421 B)
    * type SpotifyAlbum
    * type ItunesAlbumResult
    * const clientId
    * const clientSecret
    * const res
    * const data
- `src/lib/providers/tmdb.ts` (3647 B)
    * type TmdbResult
    * type ItunesVideoResult
    * const url
    * const res
    * const data
    * function makeTmdbProvider
- `src/lib/providers/types.ts` (359 B)
    * export type NormalizedSearchResult
    * export interface MediaProvider
- `src/lib/utils.ts` (166 B)
    * export function cn
- `src/proxy.ts` (1358 B)
    * const session
    * const origin
    * const isPublicGroupRoute
    * export const config
- `src/types/pocketbase-types.ts` (6148 B)
    * export const Collections
    * export type Collections
    * export type IsoDateString
    * export type IsoAutoDateString
    * export type RecordIdString
    * export type FileNameString
- `tasks.md` (2027 B)
- `tests/auth-methods.test.ts` (3719 B)
    * const authKeys
    * function extractAuthMethods
    * const oauthProviders
    * const empty
    * const googleUser
    * const multiAuthUser
- `tests/comments.test.ts` (7187 B)
    * const input
    * const maxContent
    * const tooLong
    * const multiline
    * const turkishText
    * const authorId
- `tests/custom-titles.test.ts` (2073 B)
    * const customKeys
    * const getRoleLabel
    * const dict
- `tests/errors.test.ts` (1618 B)
    * const id1
    * const id2
    * const error
    * const testError
    * const entry
    * const recent
- `tests/format.test.ts` (2015 B)
- `tests/guest-management.test.ts` (12099 B)
    * function createMockGroup
    * function createMockMembership
    * const group
    * const membership
    * const access
    * const restrictedSettings
- `tests/i18n-exhaustive.test.ts` (2306 B)
    * function compareObjects
    * const keysA
    * const keysB
    * const currentPath
    * const valA
    * const valB
- `tests/i18n.test.ts` (4730 B)
    * function secondsAgo
    * const iso
    * const future
- `tests/invite-code.test.ts` (1029 B)
    * const code
    * const validCharset
    * const code
    * const codes
- `tests/invite.test.ts` (1331 B)
    * const enKeys
    * const trKeys
    * const code
    * const origin
    * const expectedUrl
    * const raw
- `tests/landing.test.ts` (1971 B)
    * const landingKeys
    * const formattedEn
    * const formattedTr