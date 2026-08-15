# Plan: Titirek Modern UI Complete Overhaul

## 1. Objectives & Design Principles
- **Responsive Architecture**: Break free from the `max-w-md` mobile-only container constraint. Support fluid layouts from 320px mobile to 4K desktop screens.
  - Mobile (<768px): Sleek top header + bottom navigation bar + touch-friendly cards (min 44px tap targets).
  - Desktop (≥768px): Collapsible/persistent navigation sidebar or top bar + multi-column grid layouts (`max-w-6xl`/`max-w-7xl`).
- **Function-Driven Design & Aesthetics**:
  - Curated, accessible OKLCH color palette with subtle surface elevation and crisp borders.
  - Fluid typography using Geist Sans and Geist Mono with proper tracking/letter-spacing.
  - Micro-animations for vote tally transitions, card hovers, tab switches, and dialogs.
  - Zero cliché tropes: No purple-on-dark, no colored glowing borders, no icon-stuffed bento boxes, no nested cards (>2 levels).
- **Accessibility & Performance**:
  - Remove mobile pinch-to-zoom block (`maximumScale: 1`).
  - Aspect-ratio wrappers on media covers to prevent CLS.
  - Full keyboard navigation and ARIA support via `@base-ui/react`.

---

## 2. Architectural Blueprint

### A. Navigation & Responsive Shell
- Create `src/components/layout/app-shell.tsx` & `src/components/layout/desktop-sidebar.tsx`:
  - Desktop: Left sidebar with branding, navigation links (Groups, Activity, Profile, Admin if admin), active group shortcuts, user avatar, and theme toggle.
  - Mobile: Top app header + modernized `src/components/bottom-nav.tsx`.
- Move navigation rendering into a unified root/app layout so pages don't manually duplicate `<BottomNav />`.

### B. Design Tokens & Styling (`src/app/globals.css`)
- Enhance semantic tokens for card surfaces, subtle muted backgrounds, borders, and button hover states.
- Standardize media badges (Book, Movie, TV, Music, Podcast) with consistent typography, muted pastel-tinted chips, and Lucide icons.

### C. Page-by-Page Modernization
1. **Groups Dashboard (`/groups`)**:
   - Responsive grid (1 col mobile, 2–3 cols desktop) of modern group cards showing members, backlog size, consumed count, and recent activity.
   - Elegant modal/tabbed drawer for "Create Group" and "Join with Code".
2. **Group Detail View (`/groups/[groupId]`)**:
   - Header with group name, member avatar stack, copyable invite code pill, and search/add button.
   - Dual-view on desktop: Responsive tabs or 2-column layout (Backlog "Up Next" with ranking & net score on left; Consumed archive with average star ratings on right).
   - Upgraded `VoteControl` with larger touch targets and animated score indicators.
   - Rich media cards with cover art preview, metadata tags, and adder info.
3. **Add Media Search (`/groups/[groupId]/add`)**:
   - Segmented media type pills with icons.
   - Instant search input with clear button.
   - Responsive result card grid with thumbnail, metadata (year, author/artist, overview), and 1-tap "Add to Backlog" button.
4. **Activity Feed (`/activity`)**:
   - Chronological stream with relative time headers (Today, Yesterday, Earlier).
   - Rich event cards (new proposals, votes, reviews) with cover art and group badges.
5. **Group Settings (`/groups/[groupId]/settings`)**:
   - Group information card with inline rename and invite code regeneration.
   - Member management roster with role badges and owner controls.
   - Danger zone with clear destruction warnings.
6. **User Profile & Auth (`/profile`, `/login`, `/reset-password`)**:
   - Clean authentication card with tabs (OAuth, OTP Email, Password), polished form inputs, and error states.
   - Profile management with account security and theme controls.
7. **Admin Portal (`/admin/**`)**:
   - Replace raw `zinc-*` classes with theme tokens (`bg-card`, `border-border`, etc.).
   - Clean responsive metric cards, user moderation tables with status badges, and group oversight tables.

---

## 3. Step-by-Step Implementation Strategy
1. **Foundation**: Update `globals.css` tokens and fix viewport zoom in `layout.tsx`.
2. **Responsive Shell**: Implement `AppShell`, `DesktopSidebar`, and update `BottomNav`.
3. **Core UI Components**: Enhance `MediaCover`, `VoteControl`, `MediaBadge`, `ReviewForm`, `ConfirmActionButton`.
4. **Views Refactor**:
   - `/groups` (Dashboard & list)
   - `/groups/[groupId]` (Backlog & Consumed lists)
   - `/groups/[groupId]/add` (Search & propose)
   - `/groups/[groupId]/settings` (Group admin & members)
   - `/activity` (Activity stream)
   - `/profile` & `/login` (Profile & Auth)
   - `/admin` (Moderation views)
5. **Verification**: Run `bun run typecheck`, `bun run build`, and visual/behavioral checks.
