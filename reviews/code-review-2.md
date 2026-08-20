# Code Review #2 — hepyeni codebase (post-fix verification round)

Scope: all of `src/lib/**`, `src/components/**`, app pages, both fix commits
(`c5899d9`, `153fe94`). READ-ONLY — no files modified. Sanity: `bun test`
386 pass / 0 fail, `bun x tsc --noEmit` clean. `next build` not run (per
instructions; ADR-013 violations would be caught by it), `src/lib/actions/*.ts`
exports manually audited instead.

---

## Verified-Correct (applied fixes)

- **C1 — `hasPassword`/`hasOtp` truthful** — `src/lib/actions/auth.ts:39-53`.
  Both the success and catch paths now derive capability from
  `listAuthMethods()` (`methods?.password?.enabled`, `methods?.otp?.enabled`)
  collected in parallel with `listExternalAuths`; the catch path fails closed
  with `{false, false}`. Well-commented collection-level semantics match the
  review-hardening invariant. UI consumers (`AuthMethodsCard`, profile page)
  now label these "Active"/"Not Connected" — correct.
- **C2 — private `toIsoDate` copy removed** — `src/lib/actions/import-export.ts:4`
  imports `toIsoDate` from `@/lib/date`; no local copy remains. Grep confirms
  exactly one `toIsoDate` definition in the tree (`src/lib/date.ts`).
- **C3 — `extractErrorMessage` deduped** — `src/lib/errors/index.ts:17-35`
  is the single definition; `progress.ts:7` and `schedules.ts:13` import it.
  Grep confirms no other copies.
- **C4 — hardcoded Turkish action errors normalized to English** —
  `comments.ts`, `votes.ts`, `reviews.ts`, `progress.ts`, `schedules.ts`,
  `import-export.ts`, `titles.ts` all return English strings, with a
  `ponytail: <ceiling+upgrade path>` comment at the top of each (the
  error-code + client-side i18n mapping upgrade). Consistent with `auth.ts`.
- **C5 — `marginalia.ts` raw `err.message` passthrough replaced** —
  `addQuote`/`deleteQuote`/`toggleShareQuoteWithCircle` now use the
  ADR-009 shape: `logDiagnostic` + generic safe message + `traceId`
  (`src/lib/actions/marginalia.ts:68-76, 100-107, 225-235`). Log context no
  longer includes raw user input (quote text).
- **C6 — 0% progress no longer dropped** — `progress.ts:354-358` uses explicit
  `typeof p.progressCurrent === "number"` checks before computing `percentage`.
- **C7 — self-visibility asymmetry aligned** — `getCircleLiveActivity` filter
  now includes the self clause `(isSharedWithCircles != false || user = {:userId})`
  (`progress.ts:415-420`), mirrored with `getTitleCircleProgress`.
- **C8 — `mediaType?: any` → union** — `decision-wheel-dialog.tsx:43` uses
  `TitlesResponse["mediaType"]` (the PB typegen union); `as any`/`: any`
  grep across `src/` returns zero matches.
- **vote-id comment fixed** — `vote-id.ts:18-25` now accurately describes the
  15 base36 chars ≈ 77.6 bits, LSB-first emission, and unused high bits; no
  misleading "80 bits plenty" claim.
- **Other applied-and-correct from the plan**: S1/S5 marginalia anonymity
  gates (`if (!session) return []` + unconditional `requireMembership`),
  S7 `pb.filter` binding everywhere, S2 diagnostics admin-gated
  (action + hidden UI affordance), S6 `getRequestOrigin` APP_URL/trust
  contract, S4 CSV formula neutralization on both export and import,
  P2 `getGroupSchedules(groupId, session?, access?)` (page passes resolved
  session/access, `page.tsx:83`), P4 parallel milestone creation with
  explicit `orderIndex`, P6 comment-count fields projection, P3/P7 import and
  export row caps, P5 admin count queries + users pagination,
  L-2 blind-pick `expand` strip, S3-title title-page review gating, C9
  invite-code (charset is 32 chars = power of two, so `b % 32` — careful:
  `256 % 32 == 0` — is perfectly uniform; L5 was a false alarm).

## Findings by severity

### High

**H1 — P1 regression: group-page review edits now silently wipe review bodies**
`src/app/groups/[groupId]/page.tsx:109-113` + `src/app/groups/[groupId]/group-content-view.tsx:772,801` + `src/lib/actions/reviews.ts:37-38`

P1 strips `reviewText` from **every** review in the list payload,
including the current user's own review. Two follow-on regressions:

1. My-review edit form loses prefill: `defaultText={myReview?.reviewText ?? ""}`
   (group-content-view.tsx:772) is now always empty, so a member editing their
   own finished-title review from the group tab sees a blank textarea.
2. **Data loss**: saving sends `reviewText: ""`, and `submitReview` maps
   empty → `null` (`reviews.ts:38`), permanently erasing the existing review
   body. The consumed-tab row renders an editable ReviewForm with `hasExisting`,
   so a rating-only tweak destroy the prose. Pre-P1 this path preserved the text.

*Fix:* strip `reviewText` only for **other** users' reviews — keep it on the
current member's own review record, or have `group-content-view` consult the
already-loaded record. The `r.reviewText && …` branch at group-content-view.tsx:801
also becomes dead for all non-owner rows; either remove it or give those a
title-detail link.

### Medium

**M1 — Shared-quote queries leak private linked progress records to non-owners**
`src/lib/actions/marginalia.ts:124-141, 161-174`

`getUserQuotes` (non-owner path) and `getCircleQuotes` both request
`expand: "user,progressItem"`. `filterQuotesForViewer` filters the **top-level
quote rows** in JS, but leaves the expanded `progressItem` payload intact — a
sharer who linked a quote to a progress record flagged `isSharedWithCircles:
false` still exposes `notes`, `currentLabel`, moods, ratings, etc. of that
record to circle members via the expand. The Server-Only data rules (ADR-003)
make the superuser read all; the leak is at projection time.

*Fix:* project the expand server-side (`fields` on the expand) to visible
fields only, or redact/map `progressItem` through the same visibility logic
as the top-level quote.

**M2 — Turkish strings still shipped to users from the importers lib**
`src/lib/importers/index.ts:296,301`

`"Dosyada içe aktarılabilecek geçerli kayıt bulunamadı."` and
`"Dosya ayrıştırılırken hata oluştu."` (plus `raw err.message` at :301) are
returned inside `result.errors` and rendered verbatim in the import dropzone
UI (`import-dropzone.tsx:83,93`) — an EN-locale user sees Turkish. C4
normalized the *action* layer but missed the importer boundary.

*Fix:* return a stable error code / neutral English fallback through the same
`ponytail:` error-code mapping, or route through i18n keys.

**M3 — `signInWithOAuth2` bypasses the hardened origin contract (S6)**
`src/lib/actions/auth.ts:111-121`

The OAuth initiation step still builds `origin` from raw
`x-forwarded-host`/`host` headers it reads itself, ignoring `APP_URL` and the
`TRUST_FORWARDED_HEADERS` gate that the S6 fix put into `getRequestOrigin`.
Under the documented proxy contract without the trust flag, `signInWithOAuth2`
can emit a spoofable redirect target that the hardened `oauth2-callback`
(`route.ts:18`, `getRequestOrigin`) will not reproduce —
`redirect_uri` mismatch or a host-header-steered auth URL.

*Fix:* resolve origin via `getRequestOrigin` (pass a headers-shaped adapter)
instead of re-deriving it from headers in `auth.ts`.

**M4 — i18n-parity violations in core render paths**
`src/app/error.tsx:53-91`, `src/app/global-error.tsx:50-75`,
`src/app/groups/[groupId]/add/page.tsx:52-60`, `src/app/landing-view.tsx:63-87,376`

Every one of these renders hardcoded UI copy to the user without touching the
`Translations` interface (en/tr parity invariant). `error.tsx`/`global-error.tsx`
are a known limitation of error boundaries but still show Turkish-only copy to
EN users with no fallback path; `add/page.tsx` ("Medya Öner", paragraph) and
`landing-view.tsx` (inline `locale === "tr" ? "…" : "…"` note fields) are plain
i18n skew that types.ts/en.ts/tr.ts parity can't catch because the strings
aren't in the dictionary. (`terms`/`privacy` pages are intentionally
Turkish-only legal copy — noted, not flagged.)

*Fix:* move add-page + landing note strings into the `Translations` interface;
for error boundaries, add a minimal cookie-locale read or bilingual fallback.

### Low

- **L1 — Dead exported action `searchTitles`** — `src/lib/actions/titles.ts:27-58`
  (and `SearchTitlesResponse`) are no longer imported anywhere; the client
  switched to `GET /api/titles/search` (ADR-007) in `add-title-form.tsx` and
  `add-to-shelf-dialog.tsx`. Remove the action.
- **L2 — `auth-method-badges.tsx:86`** — `translations.passwordAuth.split(" ")[0]`
  is a fragile title hack (DIV consensus differs between locales), plus
  hardcoded "Google"/"Apple"/"OTP" labels at :66, :75, :96. Add dedicated
  keys. (Previously noted as a nit; still present.)
- **L3 — `getDisplayName` Turkish fallback `"Üye"`** — `src/lib/format.ts:9,12`.
  This shared helper returns a hardcoded Turkish token for nameless users in
  every locale, violating the i18n invariant at the helper layer.
- **L4 — P1 partial: DB-side projection not applied** — `page.tsx:66-70` still
  expands full `reviews_via_title` (5000-char bodies) from PocketBase, then
  strips them in JS for the RSC payload. The planned `fields` projection on the
  expand (avoid transferring `reviewText` DB→server) was not applied. Fixing
  per H1 could combine with this.
- **L5 — `getTitleCircleProgress` unguarded external-source filter**
  `src/lib/actions/progress.ts:323-330` — `src/extId` params may both be falsy
  on custom rows; `pb.filter` with undefined vars is tolerated by PB today but
  is the exact "drift-prone" L4 pattern flagged last round. Harmless now.
- **L6 — `createGroupSchedule` still non-transactional** — `schedules.ts:227-249`
  parallelises milestone writes but a mid-batch failure leaves an orphan
  schedule with partial milestones (prior L3). Add the previously promised
  `ponytail:` ceiling note or a cleanup.

## Regression check of prior fixes

| Fix | Status | Evidence |
| --- | --- | --- |
| C1 hasPassword/hasOtp | applied-correct | auth.ts:50-51, 58-60 |
| C2 toIsoDate dedupe | applied-correct | import-export.ts:4; single def |
| C3 extractErrorMessage dedupe | applied-correct | errors/index.ts:17; both callers import |
| C4 Turkish→English action errors | applied-correct (partial scope) | all actions English; **M2 importer strings missed** |
| C5 marginalia traceId pattern | applied-correct | marginalia.ts:68-76 etc. |
| C8 wheel mediaType union | applied-correct | decision-wheel-dialog.tsx:43 |
| vote-id comment | applied-correct | vote-id.ts:18-25 |
| **P1 group-page payload trim** | **partial → regression** | RSC trim real, but own-review strip causes **H1 data-loss**; DB fields projection never applied (**L4**) |

## Top 5 worth fixing now

1. **H1** — Keep the current member's own `reviewText` on the group-page
   payload so the ReviewForm prefills and saves don't null the body
   (`group-content-view.tsx:772` + `page.tsx:109-113`).
2. **M1** — Project/redact `progressItem` on shared-quote expands so private
   progress notes stay private (`marginalia.ts:124-141`).
3. **M3** — Route OAuth initiation through `getRequestOrigin` to match the S6
   trust contract (`auth.ts:111-121`).
4. **M4** — Move `add/page.tsx` and `landing-view.tsx` inline copy into the
   `Translations` dictionary to restore en/tr parity.
5. **M2** — Neutralize the remaining Turkish strings in `importers/index.ts`
   so EN import users get English/non-Turkish messages.

---

## Acceptance Report

Review is authoritative; READ-ONLY — no files modified, no `next build` run,
no subagents spawned, no worktrees used. `bun test` (386 pass) and
`bun x tsc --noEmit` (clean) executed for sanity only.