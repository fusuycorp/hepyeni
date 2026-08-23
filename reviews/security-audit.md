# HepYeni Security Audit Report

## Executive Summary
A comprehensive security audit of the HepYeni codebase was performed. The review covered authentication flows, PocketBase SSR/client interaction, Next.js Server Actions, LLM rate-limiting, and input validation. The overall security posture of the application is strong, with robust usage of PocketBase's superuser client, strictly validated input boundaries, deterministic deduplication mechanisms (like `voteRecordId`), and effective sanitization against typical injection flaws (CSV injection, SSRF). 

However, a critical data exposure vulnerability was identified and remediated in the Server Actions layer.

## Findings

### 1. PII Leak in Server Action Responses (Critical - Fixed)
**Description**: Server actions such as `getTitleCircleProgress`, `getCircleLiveActivity`, `getComments`, and `getMilestoneComments` were fetching user records via the PocketBase superuser client using `expand: "user"`. Because the superuser bypasses PocketBase API rules, it returns the full `UsersResponse` object, including the user's private `email`. These unprojected objects were being returned directly to the client from the Server Actions, exposing the email addresses of any group members who interacted with titles, milestones, or comments.
**Remediation**: Replaced the direct use of `UsersResponse` with a projected subset `QuoteUser` interface that only contains `id`, `name`, and `avatarUrl`. The `filterMilestoneCommentsForViewer` function and mapping layers in the server actions were updated to scrub the `email` field before returning data to the frontend.

### 2. Authentication & OAuth2 Flows (Secure)
**Description**: The authentication flows rely on robust state and cookie management. OAuth2 callbacks successfully utilize `state` validation with `consumeOAuth2StateCookie()`, preventing CSRF attacks during the OAuth handshake. Token management is correctly implemented with `pb.authStore.save()` limited to function scope, averting shared-state leakage across requests.

### 3. PocketBase Superuser Client (Secure)
**Description**: The `__pbSuperuser` singleton effectively handles connection multiplexing (disabling auto-cancellation). The singleton only retains superuser authentication; all user interactions correctly spawn a separate `PocketBase` instance or authenticate strictly via scoped checks. 

### 4. LLM Rate Limiting (Secure)
**Description**: The LLM rate-limiting mechanism dynamically calculates `costUnits` from input boundaries strictly enforced by `validateRawDump`, precluding bypasses involving `NaN` or negative `inputChars`. The deterministic PocketBase record reservations securely handle concurrent quota races by leveraging SQLite's unique constraints.

### 5. Input Validation & Exports (Secure)
**Description**: 
- **CSV Injection**: The `neutralizeFormulaPrefix` properly neutralizes typical spreadsheet formula indicators (`=`, `+`, `-`, `@`), even after `trim()`. 
- **Server Actions Mutations**: Next.js Server Actions robustly assert `resolveCircleAccess` and `requireOwner` where necessary before triggering mutations. All user inputs are coerced or truncated safely.

## Conclusion
The identified PII leak was patched successfully and tested via the adversarial fuzzing suite. The application correctly leverages server boundaries to authorize actions and manages rate-limiting efficiently without race conditions.
