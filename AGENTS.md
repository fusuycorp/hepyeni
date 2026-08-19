<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Development Workflow

Titirek uses **trunk-based development**: work happens on short-lived branches that become pull requests and are squash-merged into `main` after review. `main` is protected — no direct pushes.

## Branch naming

```
feat/<feature>       # new capability
fix/<bug-or-regression>
chore/<maintenance>  # lint, CI, tooling, refactors
docs/<docs-only>
```

## Flow

1. Branch off `main`: `git checkout -b fix/my-thing main`.
2. Make changes; verify locally: `bun test && bun x tsc --noEmit && bun next build && bun run lint`.
3. Commit with a conventional message, push, open a PR:
   ```bash
   git push -u origin fix/my-thing
   gh pr create --base main --head fix/my-thing
   ```
4. PRs must pass the required `ci` checks (`test` and `lint`) before merging.

## Rules

- Merge method is **squash only** (clean linear `main`); rebase branch onto `main` if it falls behind.
- Merging to `main` auto-triggers the deploy pipeline (`.github/workflows/deploy.yml`).
- Keep the `ci` gate green; do not merge with failing checks.
- Branch protection on `main` is enforced server-side; changes reach `main` only via a merged PR.

## PR template

Fill the required summary, changes, and verification checklist (`bun test`, `tsc`, `next build`, `lint`) from `.github/PULL_REQUEST_TEMPLATE.md`.
