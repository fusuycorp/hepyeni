# Titirek

**Titirek** is a modern, responsive collaborative media recommendation, voting, and consumption tracker for groups (book clubs, movie nights, music listening circles, podcast clubs).

---

## Features

- **Circle Collaboration**: Create private circles or join existing ones with 8-character invite codes.
- **Multi-Provider Media Search**:
  - **Books**: Google Books API (`book`)
  - **Movies & TV Shows**: TMDB API with v4 Bearer Token (`movie`, `tv`)
  - **Music Albums**: Spotify Web API with Client-Credentials flow (`music`)
  - **Podcasts**: iTunes Search API (`podcast`)
- **Concurrency-Resilient Voting**: Deterministic SHA-256 ID hashing guarantees atomic up/down vote toggling without duplicate vote rows or state race conditions.
- **Backlog & Consumption Tracking**: Dynamic ranking by net score (`upvotes - downvotes`), one-tap "Mark as Consumed", and 1–5 star rating reviews with average score tallying.
- **Unified Activity Timeline**: Real-time cross-group stream of proposals, votes, and member reviews.
- **Responsive Modern UI**:
  - **Desktop (≥768px)**: Persistent sidebar navigation, multi-column group dashboard, and split backlog/archive view.
  - **Mobile (<768px)**: Sleek top header, touch-friendly hit targets (≥44px), and bottom navigation bar.
  - **Theming**: Seamless dark and light mode toggle via `next-themes`.
- **Administrative Portal**: Complete dashboard for platform metrics, user moderation (role management, account bans), and group oversight.
- **AI-Assisted Text Extraction**: Optionally send pasted recommendation lists to a configured OpenAI-compatible LLM after an explicit disclosure acknowledgement.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | [Bun](https://bun.sh) (`bun@1.3.14`) |
| **Framework** | [Next.js](https://nextjs.org) 16.3.0 App Router + React 19 |
| **Database & Auth** | [PocketBase](https://pocketbase.io) (`pocketbase@0.27.3`, SQLite) |
| **UI Components** | Tailwind CSS v4, Base UI (`@base-ui/react`), Lucide React, Sonner |
| **Testing** | Bun Test Runner (`bun test`) |
| **Type Generation** | `pocketbase-typegen@1.5.0` |

---

## Security Architecture

1. **Zero Client-Side DB Access**: All PocketBase collections enforce `null` API rules (superuser only). Every database interaction executes server-side in Next.js Server Actions via `getSuperuserClient()`.
2. **Strict Multi-Tenant IDOR Defense**: Every mutation strictly validates `requireMembership`, `requireTitleInGroup`, and `requireOwner` before executing.
3. **Instant Ban Enforcement**: Session token validation calls live `authRefresh()` on PocketBase on each request, revoking banned users immediately.
4. **Resilient Network Requests**: External provider requests are guarded with `AbortSignal.timeout(8000)` to prevent hanging upstream connections.
5. **Sanitization & Boundary Checks**: String inputs, passwords, and review comments are bounded on the server to prevent unbounded payload abuse.

---

## Local Development

### 1. Start PocketBase
Download and start a local PocketBase instance (migrations in `pb_migrations/` apply automatically on startup):

```bash
# Download and unzip PocketBase (Linux/macOS)
curl -L https://github.com/pocketbase/pocketbase/releases/download/v0.27.2/pocketbase_0.27.2_linux_amd64.zip -o pocketbase.zip
unzip pocketbase.zip pocketbase
./pocketbase serve
```

On first run, create a superuser:
```bash
./pocketbase superuser upsert you@example.com yourpassword
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and set required variables:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `PB_URL` | Yes | PocketBase URL (`http://127.0.0.1:8090` locally) |
| `PB_SUPERUSER_EMAIL` | Yes | PocketBase superuser email |
| `PB_SUPERUSER_PASSWORD` | Yes | PocketBase superuser password |
| `APP_URL` | Yes (for OAuth) | Public origin URL (e.g. `http://localhost:3000`) |
| `TMDB_API_KEY` | Optional | TMDB v4 Bearer Token for movie/TV search |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Optional | Spotify API credentials for music search |
| `FLAG_ENABLE_LLM_EXTRACT` | Optional | Enable text extraction only when set to `true` and an LLM key is configured |
| `LLM_API_URL` | Optional | OpenAI-compatible chat-completions base URL, including a local Ollama endpoint |
| `LLM_API_KEY` | Optional | Server-only LLM bearer token; inject at runtime and never bake into images |
| `LLM_MODEL` | Optional | Chat model name, default `gpt-4o-mini` |

### 3. Install Dependencies & Run
```bash
bun install
bun run dev
```

---

## Testing & Quality Assurance

```bash
# Run unit & integration tests
bun test

# Run TypeScript typechecker
bun run typecheck

# Run ESLint
bun run lint

# Build production bundle
bun run build
```

### LLM data processing

The optional Extract from Text importer sends only the text the user pastes, and only after the user checks the localized acknowledgement. The request does not include the user's account identity or PocketBase records. Titirek does not use submitted text to train its own models, but the configured provider may process or retain requests under its own policy. Users should not paste passwords, tokens, private messages, or other sensitive data; a local LLM endpoint is available through `LLM_API_URL`.

`LLM_API_KEY` is a runtime secret. Pass it through `.env.local`, Docker Compose, or the production secret manager. Do not add it to `Dockerfile` build arguments, `ENV` instructions, source files, or image layers.

---

## Development Workflow

Titirek uses **trunk-based development**: work happens on short-lived branches that become pull requests and are squash-merged into `main` after review. `main` is protected — no direct pushes.

### Branch naming

```
feat/<feature>       # new capability
fix/<bug-or-regression>
chore/<maintenance>  # lint, CI, tooling, refactors
docs/<docs-only>
```

### Flow

```bash
git checkout -b fix/my-thing
# ...make changes, verify locally...
bun test && bun x tsc --noEmit && bun next build && bun run lint

git add -A
git commit -m "fix(scope): concise conventional message"
git push -u origin fix/my-thing
gh pr create --base main --head fix/my-thing
# CI runs automatically; merge is gated on passing checks + one approval
```

- Merge method is **squash only** for a clean linear `main`.
- Merges to `main` auto-trigger the deploy pipeline (`.github/workflows/deploy.yml`).
- The `ci` check (tests, typecheck, build, lint) is a required gate — keep it green.

---

## Documentation

Comprehensive architecture, security, and developer reference guides are available in the [`docs/`](file:///home/devhax/projects/fusuycorp/titirek/docs/README.md) directory:

- [**System Architecture**](file:///home/devhax/projects/fusuycorp/titirek/docs/ARCHITECTURE.md): Server Action model, PocketBase superuser client, live session verification, and concurrency defense.
- [**Codebase Map**](file:///home/devhax/projects/fusuycorp/titirek/docs/CODEBASE_MAP.md): Detailed directory tree and file breakdown.
- [**Auth & Security**](file:///home/devhax/projects/fusuycorp/titirek/docs/AUTH_AND_SECURITY.md): Multi-provider auth flows, IDOR defense, and ban enforcement.
- [**Data Models**](file:///home/devhax/projects/fusuycorp/titirek/docs/DATA_MODELS.md): PocketBase collections, ERD, and relational cascading.
- [**External Media APIs**](file:///home/devhax/projects/fusuycorp/titirek/docs/EXTERNAL_APIS.md): Google Books, TMDB, Spotify, and iTunes integrations.
- [**Deployment & Infrastructure**](file:///home/devhax/projects/fusuycorp/titirek/docs/DEPLOYMENT_AND_INFRA.md): Docker Swarm, Dokploy, and environment setup.

---

## Architectural Decision Records

Major architectural choices, security defenses, and design patterns are documented in [`DECISIONS.md`](file:///home/devhax/projects/fusuycorp/titirek/DECISIONS.md).

---

## Deployment

Containerized via `Dockerfile` and deployed on **Docker Swarm** with **Dokploy**. CI (`.github/workflows/deploy.yml`) builds the image, pushes to `registry.bogazici.app/budok/titirek`, and triggers Dokploy redeployments.
