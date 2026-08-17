# Repository Map

Total mapped files: 144

- `.agents/activity.jsonl` (7655 B)
- `.agents/decisions.md` (7222 B)
- `.agents/memory.md` (4619 B)
- `.agents/repo_map.md` (15156 B)
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
- `src/app/groups/[groupId]/group-content-view.tsx` (22754 B)
    * type TitleWithScore
    * interface GroupContentViewProps
    * export function GroupContentView
    * const t
    * const filteredProposed
    * const filteredConsumed
- `src/app/groups/[groupId]/page.tsx` (8270 B)
    * type TitleExpand
    * const session
    * const pb
    * const t
    * const commentCounts
    * const currentMember
- `src/app/groups/[groupId]/settings/page.tsx` (12021 B)
    * const session
    * const pb
    * const t
    * const isOwner
    * const currentUser
    * const userName
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
- `src/app/page.tsx` (223 B)
    * const session
- `src/app/privacy/page.tsx` (10981 B)
    * export const metadata
    * const lastUpdated
- `src/app/profile/page.tsx` (9278 B)
    * const session
    * const pb
    * const user
    * const t
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
- `src/components/bottom-nav.tsx` (1923 B)
    * export function BottomNav
    * const pathname
    * const t
    * const tabs
    * const active
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
- `src/components/mark-consumed-button.tsx` (1117 B)
    * export function MarkConsumedButton
    * const t
    * const label
    * const errorMessage
- `src/components/media-badge.tsx` (1775 B)
    * interface MediaBadgeProps
    * const MEDIA_ICONS
    * const MEDIA_STYLES
    * export function MediaBadge
    * const t
    * const Icon
- `src/components/media-comments.tsx` (13256 B)
    * type OptimisticComment
    * type DisplayComment
    * interface MediaCommentsProps
    * export function MediaComments
    * const formRef
    * const listRef
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
- `src/components/vote-control.tsx` (4895 B)
    * type VoteValue
    * type VoteState
    * export function VoteControl
    * const t
    * const delta
    * function vote
- `src/lib/actions/admin.ts` (4253 B)
    * const session
    * const callerId
    * const pb
    * const callerId
    * const pb
    * const pb
- `src/lib/actions/auth.ts` (8355 B)
    * const pb
    * const methods
    * const providers
    * const pb
    * const methods
    * const diag
- `src/lib/actions/comments.ts` (2863 B)
    * const session
    * const rawContent
    * const content
    * const pb
    * const comment
    * const session
- `src/lib/actions/diagnostics.ts` (429 B)
    * const session
- `src/lib/actions/groups.ts` (9792 B)
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
- `src/lib/actions/reviews.ts` (1547 B)
    * const session
    * const rating
    * const rawReview
    * const reviewText
    * const pb
    * const existing
- `src/lib/actions/titles.ts` (6297 B)
    * export type SearchTitlesResponse
    * const session
    * const cleanQuery
    * const results
    * const diag
    * const session
- `src/lib/actions/votes.ts` (2199 B)
    * const session
    * const pb
    * const id
    * const existing
- `src/lib/admin.ts` (402 B)
    * const pb
    * const user
- `src/lib/comments.ts` (805 B)
    * export function validateCommentContent
    * const content
    * export function canDeleteComment
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
- `src/lib/i18n/en.ts` (17794 B)
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
- `src/lib/i18n/tr.ts` (19620 B)
    * export const tr
- `src/lib/i18n/types.ts` (10597 B)
    * export type Locale
    * export interface Translations
- `src/lib/invite-code.ts` (263 B)
    * const CHARSET
    * export function generateInviteCode
    * const bytes
- `src/lib/media-types.ts` (137 B)
    * export const MEDIA_TYPES
    * export type MediaType
- `src/lib/membership.ts` (1933 B)
    * const pb
    * const membership
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
- `src/proxy.ts` (1140 B)
    * const session
    * const origin
    * export const config
- `src/types/pocketbase-types.ts` (5782 B)
    * export const Collections
    * export type Collections
    * export type IsoDateString
    * export type IsoAutoDateString
    * export type RecordIdString
    * export type FileNameString
- `tasks.md` (2027 B)
- `tests/comments.test.ts` (2980 B)
    * const input
    * const maxContent
    * const tooLong
    * const authorId
    * const otherUserId
    * const ownerId
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
- `tests/media-types.test.ts` (1323 B)
- `tests/membership.test.ts` (1541 B)
    * const notFoundError
    * const badRequest
    * const serverError
    * const genericError
    * const uniqueError
- `tests/origin.test.ts` (2167 B)
    * const mockReq
    * const origin
    * const mockReq
    * const origin
    * const mockReq
    * const origin
- `tests/providers.test.ts` (2126 B)
    * const types
    * const provider
    * const results
    * const bookProvider
    * const bookResults
    * const musicProvider
- `tests/vote-id.test.ts` (1142 B)
    * const id
    * const id1
    * const id2
    * const id1
    * const id2
    * const id3
- `tsconfig.json` (670 B)