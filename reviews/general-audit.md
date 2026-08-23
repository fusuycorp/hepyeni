# General Code Quality Audit

## 1. Next.js `"use server"` Constraints
- **Goal**: Ensure no synchronous helpers, constants, or purely synchronous functions leak out from `src/lib/actions/*.ts` as exports (ADR-013).
- **Finding**: Verified. No synchronous exports were found in `"use server"` files. They exclusively export `async function` or `type`/`interface`.

## 2. Ponytail Debt Ledger
- **Goal**: Check adherence to the Ponytail debt ledger (`.agents/memory.md`).
- **Finding**: The `## KNOWN DEBT` section in `.agents/memory.md` was missing. We had various `# ponytail:` comments in the code indicating deferred tasks or technical debt (e.g. lack of pagination, english-only server action error strings, lack of transactional batching for milestones).
- **Action**: Extracted `# ponytail:` debts and added them to `## KNOWN DEBT` in `.agents/memory.md` to restore ledger tracking as per `user_global` rules.

## 3. Overall Code Duplication
- **Goal**: Check for duplicated code (drift-prone logic).
- **Finding**: Run `jscpd` across the codebase (`src/`). Overall clone duplication is low (~3.2%). Minor boilerplate overlaps in Next.js Server Actions (e.g., formData parsing for email/password in `auth.ts`) and dialogs, but no massive function copy-pastes were identified that warrant a structural abstraction right now. Functions like `getDisplayName` and `formatRelativeTime` are properly centralized in `src/lib/format.ts` and `src/lib/i18n/` respectively.

## Conclusion
The repository remains in good structural health. The main action taken was to re-surface `# ponytail:` deferrals into the project memory ledger so they don't rot.
