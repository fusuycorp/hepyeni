I have completed a thorough read of the source and verified my findings against types, migrations, and callers. Here is the review.

---

# Code Review — titirek codebase

Scope reviewed: `src/lib/actions/*.ts` (all 14), core `src/lib/*.ts` (`date`, `format`, `comments`, `marginalia`, `schedules`, `membership`, `moods`, `errors`, `invite-code`, `utils`, `flags/*`, `pocketbase/*`), key components and app pages, and `pb_migrations` for schema/unique-index ground truth. `node_modules`, `.git`, `.agents` excluded per instructions. Multiple unit/adversarial test suites confirm the codebase is well-tested; the ADR/user-facing invariants are largely honored.

## Verified-positive (Correct)

- **ADR-013 "use server" boundary is clean.** Every exported member of every `src/lib/actions/*.ts` file is either an `async function` or a type (`export interface` / `export type`). I grepped all 14 files (`^export (const|function|interface|type|class|async)`) and found **no** sync function, constant, or `export { syncFn }` re-export leaking from a `"use server"` file. Internal non-exported sync helpers are allowed and present without issue.
- **Display-name / initials / relative-time helpers are centralized** in `src/lib/format.ts` (`getInitials`, `getDisplayName`) and `src/lib/i18n/index.ts` (`formatRelativeTime`). Callers across ~10 components all import from these — the historical drift was already fixed; no inline duplicates found.
- **Multi-tenant IDOR guards are consistently applied** (`requireMembership`, `requireTitleInGroup`, `requireScheduleInGroup`, `requireMilestoneInGroup`, `requireOwner`) across all mutating actions, including the `requireTitleInGroup` pairing with `resolveCircleAccess` in `addComment`/`voteOnTitle`/`submitReview`.
- **Atomic vote/review upserts are backed by real unique indexes** (`idx_votes_unique`, `idx_reviews_unique`, `idx_idx_checkin_unique`, `idx_group_members_unique` in `pb_migrations`), so the unique-constraint-recovery logic is grounded, not speculative.
- **`milestone_checkins` toggle + spoiler redaction** (`filterMilestoneCommentsForViewer`) correctly strips bodies and `email` from locked comments; gating is server-side as designed.

---

## Findings

### Medium

**M1 — `getUserAuthMethods` hardcodes `hasPassword`/`hasOtp = true`, so the auth-method UI lies for OAuth-only users**
`src/lib/actions/auth.ts:27-52`
Both the success path (lines 34–35) and the catch path (lines 46–47) return `hasPassword: true, hasOtp: true` unconditionally. The function ostensibly *discovers* a user's sign-in methods, but it never inspects whether the user actually has a password or OTP — it only resolves OAuth providers. Rendered by `AuthMethodHeaderBadges` (`src/components/auth-method-badges.tsx:95-118`) and `AuthMethodsCard` (`connected: authMethods.hasPassword`), every user, including one who signed up purely via Google/Apple OAuth, is shown "Password: Active" and "OTP: Active".
*Fix:* Actually resolve per-user capability — e.g. query whether the user record has a password set (PocketBase exposes password presence via the auth record / a `users` field) and whether OTP-verify is configured — or drop the two always-true fields and render only real data. Smallest safe fix: compute `hasPassword`/`hasOtp` from the PB record instead of `true`.

**M2 — Divergent, validation-weaker copy of `toIsoDate` in the import-export action**
`src/lib/actions/import-export.ts:34-42` (duplicates `src/lib/date.ts:1`)
The canonical `src/lib/date.ts` `toIsoDate` guards malicious characters (`/[;<>'"`]|--|\/\*/`) and validates a sane year range (`1000–9999`), plus a `toISOString` try/catch. The private copy in `import-export.ts` returns the ISO date with **no** injection-guard regex and **no** year-range check. This is precisely the drift-prone copy-paste the repo memory warns about, and it's the weaker version. It feeds `item.dateAdded`/`item.dateFinished` from parsed importer payloads (external data) directly into `startedAt`/`completedAt`.
*Fix:* delete the local `toIsoDate` in `import-export.ts` and `import { toIsoDate } from "@/lib/date"` (same fix as `progress.ts`/`schedules.ts` already use).

**M3 — `extractErrorMessage` is copy-pasted in two action files**
`src/lib/actions/progress.ts:24-32` and `src/lib/actions/schedules.ts:37-45` — byte-identical duplicated function. Drift risk + redundant code. Extract to a shared file (e.g. `src/lib/errors`) and import in both. (Low impact now, but it's the second example of the same copy-paste the memory flags.)

**M4 — Server-action user-facing errors are hardcoded Turkish, inconsistent across files**
`src/lib/actions/comments.ts:20,110`, `votes.ts:20`, `reviews.ts:18`, `progress.ts:90,211,256`, `schedules.ts:179,265,290,315,410,485`, `import-export.ts:46,201` all return `"Lütfen önce giriş yapın."` et al., while `auth.ts`, `profile.ts`, `admin.ts` return English ("Please sign in first"). Since `ActionResult.error` is shown verbatim in client toasts, English-locale users of the shell/member actions will see Turkish errors. This conflicts with the i18n parity invariant (components "never hardcode a string"; the same principle is recommended for action messages).
*Fix:* route these messages through `src/lib/i18n` (or at minimum normalize to a single consistent language); the smallest safe improvement is returning a stable error *code* and mapping to translated strings client-side, consistent with the `?error=`-style pattern used in `login/page.tsx`.

**M5 — Raw error message passthrough leaks internals to the client**
`src/lib/actions/marginalia.ts` (`addQuote`, `deleteQuote`, `toggleShareQuoteWithCircle`) return `error: err instanceof Error ? err.message : "Failed to add quote"` (also `deleteQuote`, `getUserQuotes` use `?.[...]` patterns). This surfaces PocketBase validation messages / field names and raw provider text to the user, diverging from ADR-009's "safe localized message + traceId" convention used elsewhere.
*Fix:* follow the standard `logDiagnostic(...)` + generic localized message + `traceId` shape used by the other actions.

### Low

**L1 — `getTitleCircleProgress` never renders 0%** (`src/lib/actions/progress.ts:352-357`): `p.progressCurrent && p.progressTotal` treats `0` as falsy, so a member at 0% progress on an in-progress title shows no percentage column. Use explicit `typeof p.progressCurrent === "number"` checks.

**L2 — Privacy-visibility clause inconsistent between the two circle-read actions** (`progress.ts`): `getTitleCircleProgress` includes the viewer's own record even when `isSharedWithCircles === false` (`p.user === session?.id`), but `getCircleLiveActivity` (`filter: 'status = "in_progress" && isSharedWithCircles != false'`, line ~443) has no equivalent self-inclusion. If a user marks their own in-progress item private, it disappears from their own circle's live feed. Likely intended, but the asymmetry is surprising and untested — document it or add the `|| p.user = "..."` clause.

**L3 — `createGroupSchedule` is not transactional** (`src/lib/actions/schedules.ts:194-254`): the schedule is created first, then milestones in a loop, with no rollback if a milestone write fails midway — leaving an orphaned/partial schedule. Acceptable for now, but worth a wrapped cleanup or a `ponytail:` comment noting the ceiling.

**L4 — Type-safety `any` and loose typing**:
- `src/components/decision-wheel-dialog.tsx:30` — `mediaType?: any` on `TitleItem`.
- `getTitleCircleProgress` builds `externalSource = {:src} && externalId = {:extId}` from `title.externalSource`/`title.externalId` which could be undefined/empty for custom rows; harmless today because custom titles always carry `custom_*` IDs, but worth a guard.

**L5 — `generateInviteCode` modulo bias** (`src/lib/invite-code.ts:4-6`): `CHARSET[b % 30]` over 256 byte values biases the first 16 alphabet characters. Negligible entropy loss for an 8-char invite code; a small `rejection sampling` would remove it (lazy note, not urgent).

**L6 — Performance: two PocketBase round-trips per action.** Most actions call `getSession()` (a fresh `new PocketBase(...)` + `authRefresh` per call — `session.ts:26-40`) *and* `getSuperuserClient()`. The auth-refresh-on-every-request model is intentional (ban immediacy), but serializing a superuser auth per action plus a per-request `authRefresh` is 2+ network calls on core mutations. Consider `Promise.all`/caching where the session is used only for identity.

---

## Note (no action required)

- `vote-id.ts:17-38`: comment claims "80 bits plenty" but the loop only emits 15 base36 chars (≈77.6 bits), dropping the most significant digit. Deterministic and collision-safe at this app's scale (birthday bound still negligible) — the comment is slightly misleading, not a bug.
- `src/components/auth-method-badges.tsx:105,138` render hardcoded `"OTP"`/`"Google"`/`"Apple"` labels and `translations.passwordAuth.split(" ")[0]` — minor i18n nits.

---

## Top 5 worth fixing now

1. **M1** — Stop lying about `hasPassword`/`hasOtp` in `getUserAuthMethods` (auth.ts) and render real state; the Profile auth UI is factually incorrect for OAuth-only users.
2. **M2** — Delete the divergent `toIsoDate` copy in `import-export.ts` and import the guarded canonical one from `@/lib/date`.
3. **M4** — Normalize action error strings; remove the hardcoded-Turkish/English mix so EN users get English toasts.
4. **M5** — Stop leaking raw `err.message` to clients in `marginalia.ts`; use the standard `traceId` + safe localized message pattern.
5. **M3 / L1** — De-duplicate `extractErrorMessage` into `src/lib/errors`, and fix the `p.progressCurrent && ...` 0% false-negative in `getTitleCircleProgress`.

---

## Acceptance Report

Review is authoritative; READ-ONLY — no files modified, no builds/mutations run, no subagents spawned.