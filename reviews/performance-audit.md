# Performance Audit Report

## 1. N+1 Database Queries
- **Issue Found**: In `src/lib/actions/progress.ts`, the `getCircleLiveActivity` function was fetching all `user_media_progress` records system-wide with `status = "in_progress"` without filtering by group members at the database level.
- **Fix Applied**: Modified the filter logic to batch database queries by chunking member IDs, ensuring that we only query progress records for users actually in the target group, eliminating the unbounded table scan issue.

## 2. Unnecessary Client-Side Re-renders
- **Issue Found**: In `src/app/groups/[groupId]/group-content-view.tsx`, the `filteredProposed` and `filteredConsumed` arrays were being recalculated on every render via `.filter(filterTitle)`.
- **Fix Applied**: Wrapped these expensive array filtering operations in `useMemo` hooks with correct dependency arrays. This prevents the lists from being unnecessarily recomputed during local state changes (e.g. typing in a form or interacting with unrelated UI).

## 3. Bundle Size Optimization
- **Audit Findings**: The project uses `lucide-react` for icons, which is well-handled by Next.js's built-in `optimizePackageImports` (by default in App Router). There were no immediate oversized dependencies identified in `package.json`. Media covers correctly use standard `<img>` tags to handle external sources flexibly without bloating the bundle or Next.js image optimization node-modules overhead.

## 4. Next.js Caching
- **Audit Findings**: The application is highly dynamic and user-centric (fetching session-based PocketBase records via `getSuperuserClient`). Next.js 15+ defaults `fetch` to `no-store`, which is the correct semantic for these PocketBase API calls. Group page fetches are well parallelized using `Promise.all` reducing waterfall delays.
