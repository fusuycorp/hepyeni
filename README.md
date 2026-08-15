# Titirek

Mobile-optimized reading/watch/listen group tracker: groups add and vote on
books, movies & TV, music, and podcasts, then rate and review once consumed.

## Stack

- **Next.js** (App Router) on **Bun** — see [`docs/project-creation.md`](https://github.com/fusuycorp) conventions
- **PocketBase** (self-hosted, SQLite-backed BaaS) for persistence and auth
- Google OAuth2 + email OTP sign-in, both via PocketBase's built-in auth

## Local development

1. Download and run a local PocketBase instance (the app talks to it entirely
   server-side — every collection's API rules are superuser-only, see
   `pb_migrations/`):

   ```bash
   # macOS/Linux, adjust version/arch as needed — see https://pocketbase.io/docs/
   curl -L https://github.com/pocketbase/pocketbase/releases/download/v0.27.2/pocketbase_0.27.2_linux_amd64.zip -o pocketbase.zip
   unzip pocketbase.zip pocketbase
   ./pocketbase serve
   ```

   On first run, create a superuser (`./pocketbase superuser upsert you@example.com yourpassword`).
   `pb_migrations/` is applied automatically on startup when run from this
   repo's root.

2. Copy `.env.example` to `.env.local` and fill in the values (see below).

3. Install deps and start the dev server:

   ```bash
   bun install
   bun run dev
   ```

   > Scripts run via `bun --bun` to force Next.js onto Bun's runtime.

### Environment variables

| Variable | Required for | Notes |
| --- | --- | --- |
| `PB_URL` | everything | PocketBase instance URL (`http://127.0.0.1:8090` locally) |
| `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD` | everything | The app's own server-side PocketBase client authenticates as this superuser — see `src/lib/pocketbase/superuser.ts` |
| `APP_URL` | Google sign-in | Must match the Google OAuth2 redirect URI exactly |
| `TMDB_API_KEY` | movies/TV search | TMDB's v4 "API Read Access Token" (Bearer), not the v3 API Key |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | music search | added when that media type ships |

Google OAuth2 credentials and the PurelyMail SMTP config used for OTP emails
are configured on the PocketBase instance itself (Admin UI or Settings API),
not via this app's env vars.

### Database

Schema is declarative — `pb_migrations/*.js`, applied automatically by
PocketBase on startup. To change the schema, edit/add a migration file
there (see PocketBase's [JS migrations docs](https://pocketbase.io/docs/js-migrations/)).

## Docker

`Dockerfile` and `docker-compose.yml` live in this repo (not the deployment
docs repo) so CI can build from a plain `actions/checkout` — matching the
`boun-scrape`/`uniyok-atlas` convention. `docker-compose.yml` only runs the
Next.js app; point `PB_URL` at a PocketBase instance you're running
separately (see Local development above, or the production companion
container documented in the deployment repo).

## Deployment

Production Swarm stack config (`docker-stack.yml`, env docs) lives in the
org's `~/deployment/selfhosted` repo under `services/titirek/` — that repo
only holds the stack config that references the pre-built registry image,
not a copy of the Dockerfile. CI (`.github/workflows/deploy.yml`) builds and
pushes to `registry.bogazici.app/budok/titirek`, then triggers a Dokploy
redeploy. See `docs/dokploy-guide.md` in the deployment repo for the full
Dokploy API reference.
