# Titirek

Mobile-optimized reading/watch/listen group tracker: groups add and vote on
books, movies & TV, music, and podcasts, then rate and review once consumed.

## Stack

- **Next.js** (App Router) on **Bun** — see [`docs/project-creation.md`](https://github.com/fusuycorp) conventions
- **PostgreSQL** via **Drizzle ORM** (`drizzle-orm/bun-sql`, Bun's native SQL client)
- **Auth.js** (Google OAuth + email magic-link) with the Drizzle adapter

## Local development

1. Start a local Postgres:

   ```bash
   docker run -d --name titirek-postgres \
     -e POSTGRES_USER=titirek \
     -e POSTGRES_PASSWORD=titirek_dev \
     -e POSTGRES_DB=titirek \
     -p 127.0.0.1:5432:5432 \
     postgres:16-alpine
   ```

2. Copy `.env.example` to `.env.local` and fill in the values (see below).

3. Install deps and run migrations:

   ```bash
   bun install
   bun run db:migrate
   ```

4. Start the dev server:

   ```bash
   bun run dev
   ```

   > Scripts run via `bun --bun` to force Next.js onto Bun's runtime — required
   > because the DB client (`drizzle-orm/bun-sql`) uses Bun's built-in `SQL`
   > class, which isn't available under Node.

### Environment variables

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | everything | Postgres connection string |
| `AUTH_SECRET` | everything | `bunx auth secret` or `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google sign-in | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) OAuth client |
| `AUTH_RESEND_KEY` / `EMAIL_FROM` | email magic-link | added in a later milestone |
| `TMDB_API_KEY` | movies/TV search | TMDB's v4 "API Read Access Token" (Bearer), not the v3 API Key |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | music search | added when that media type ships |

### Database

- `bun run db:generate` — generate a migration from schema changes (`src/db/schema.ts`)
- `bun run db:migrate` — apply pending migrations
- `bun run db:studio` — browse the local database

## Docker

`Dockerfile` and `docker-compose.yml` live in this repo (not the deployment
docs repo) so CI can build from a plain `actions/checkout` — matching the
`boun-scrape`/`uniyok-atlas` convention. For local Docker Compose instead of
`bun run dev`:

```bash
cp .env.example .env
docker compose up -d
docker compose run --rm migrate
```

## Deployment

Production Swarm stack config (`docker-stack.yml`, env docs) lives in the
org's `~/deployment/selfhosted` repo under `services/titirek/` — that repo
only holds the stack config that references the pre-built registry image,
not a copy of the Dockerfile. CI (`.github/workflows/deploy.yml`) builds and
pushes to `registry.bogazici.app/budok/titirek`, then triggers a Dokploy
redeploy. See `docs/dokploy-api-guide.md` in the deployment repo for the
full Dokploy API reference.
