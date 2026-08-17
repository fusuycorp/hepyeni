# Titirek Deployment & Infrastructure Guide

This document details the Docker containerization, Docker Swarm stack, Dokploy integration, CI/CD deployment pipelines, and environment configuration for **Titirek**.

---

## 1. Infrastructure Overview

Titirek runs as a containerized stack on **Docker Swarm** managed via **Dokploy**.

```mermaid
flowchart LR
    subgraph Edge / DNS
        CF[Cloudflare Edge DNS & SSL]
    end

    subgraph Entry Node / HakimBey
        TR[Traefik Ingress Proxy]
    end

    subgraph Swarm Nodes
        subgraph Overlay: dokploy-network
            APP[titirek: Next.js Standalone Runner<br/>2 replicas, node.labels.type == tanri]
            PB[pocketbase: BaaS + Migrations<br/>1 replica, node.labels.type == worky]
            VOL[(Volume: titirek_pb_data)]
        end
    end

    CF -->|HTTPS hepyeni.net| TR
    CF -->|HTTPS pb.hepyeni.net| TR
    TR -->|Port 3000| APP
    TR -->|Port 8090| PB
    APP -->|Internal HTTP| PB
    PB --- VOL
```

### Key Infrastructure Attributes:
- **Application URL**: `https://hepyeni.net`
- **PocketBase Admin UI**: `https://pb.hepyeni.net/_/`
- **Container Registry**: `registry.bogazici.app/budok/titirek`
- **Swarm Overlay Network**: `dokploy-network`

---

## 2. Docker Containers

### 2.1 Next.js Application: `Dockerfile`
Located in [`Dockerfile`](file:///home/devhax/projects/fusuycorp/titirek/Dockerfile), this multi-stage build creates an optimized Next.js standalone runner:

1. **`base`**: Uses `oven/bun:1-alpine` for minimal image footprint and fast runtime execution.
2. **`deps`**: Runs `bun install --frozen-lockfile`.
3. **`builder`**: Copies dependencies and runs `bun --bun next build`.
   > [!NOTE]
   > Bun 1.3.14 contains an upstream engine exit issue where the process may segfault after successfully writing `.next/standalone`. The build step gates on `bun --bun next build; test -f .next/standalone/server.js` to ensure the artifact exists before proceeding.
4. **`runner`**: Copies the standalone server, creates an unprivileged user (`nextjs:nodejs` UID/GID 1001), and starts the server via `CMD ["bun", "run", "server.js"]` on port 3000.

### 2.2 PocketBase with Baked Migrations: `Dockerfile.pocketbase`
Located in [`Dockerfile.pocketbase`](file:///home/devhax/projects/fusuycorp/titirek/Dockerfile.pocketbase):

```dockerfile
FROM ghcr.io/muchobien/pocketbase:0.39.11
COPY pb_migrations /pb_migrations
```

- **Baked Migrations**: Dokploy deploys pre-built images rather than building from git checkouts on nodes. Copying `pb_migrations/` into `/pb_migrations` ensures migrations automatically apply when the container launches.
- **Data Persistence**: Backed by the named Docker volume `titirek_pb_data:/pb_data`.
- **Admin Bootstrap**: The base image bootstraps the superuser on initial boot via `PB_ADMIN_EMAIL` and `PB_ADMIN_PASSWORD`.

---

## 3. Dokploy Swarm Stack Configuration

Production services are defined in `services/titirek/docker-stack.yml` in the selfhosted deployment repository (this is a summary — that file is authoritative, see its own comments for the reasoning behind each deviation from the generic template, e.g. the `/pb_data` mount path and why Traefik labels are omitted in favor of Dokploy's dynamic domain management):

```yaml
services:
  titirek:
    image: ${IMAGE_NAME:-registry.bogazici.app/budok/titirek:latest}
    environment:
      - PB_URL=http://pocketbase:8090
      - PB_SUPERUSER_EMAIL=${PB_SUPERUSER_EMAIL}
      - PB_SUPERUSER_PASSWORD=${PB_SUPERUSER_PASSWORD}
      - APP_URL=${APP_URL:-https://hepyeni.net}
      - TMDB_API_KEY=${TMDB_API_KEY}
      - SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
      - SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
    networks:
      - dokploy-network
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/login || exit 1"]
      interval: 20s
      timeout: 5s
      retries: 3
      start_period: 10s
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
      placement:
        constraints:
          - node.labels.type == tanri

  pocketbase:
    image: ${PB_IMAGE_NAME:-registry.bogazici.app/budok/titirek-pb:latest}
    environment:
      - TZ=Europe/Istanbul
      - PB_ADMIN_EMAIL=${PB_SUPERUSER_EMAIL}
      - PB_ADMIN_PASSWORD=${PB_SUPERUSER_PASSWORD}
    volumes:
      - titirek_pb_data:/pb_data
    networks:
      - dokploy-network
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1:8090/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 15s
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      placement:
        constraints:
          - node.labels.type == worky
      resources:
        limits:
          cpus: "1.50"
          memory: 512M
        reservations:
          cpus: "0.10"
          memory: 64M

networks:
  dokploy-network:
    external: true

volumes:
  titirek_pb_data:
```

---

## 4. CI/CD Deployment Pipeline

Two independent workflows watch `main`:

### 4.1 App image: `.github/workflows/deploy.yml`
Triggers on every push to `main` (excluding `**.md`/`.gitignore`):

1. **Build & Push Job**:
   - Checks out the repository.
   - Sets up Docker Buildx.
   - Logs into `registry.bogazici.app` using repository secrets `REGISTRY_USERNAME` and `REGISTRY_PASSWORD`.
   - Builds and pushes `registry.bogazici.app/budok/titirek:latest`.
2. **Dokploy Redeploy Trigger** (`needs: build-and-push`):
   - Sends an authenticated `POST /api/compose.redeploy` request to `https://dokploy.bogazici.app` with `x-api-key: ${{ secrets.DOKPLOY_API_KEY }}`.
   - If that fails, retries once with a differently-shaped (tRPC-wrapped) payload against the same endpoint, since Dokploy's API has historically accepted either shape depending on version. This is a fixed two-attempt fallback, **not** a retry loop and **not** exponential backoff — there is no delay between attempts, and both attempts fire immediately in the same job run.

### 4.2 PocketBase image: `.github/workflows/deploy-pocketbase.yml`
Triggers only when `pb_migrations/**` or `Dockerfile.pocketbase` change on `main`. Builds and pushes `registry.bogazici.app/budok/titirek-pb:latest` — deliberately does **not** call `compose.redeploy` itself (see the workflow's own header comment); the coordinated stack redeploy that picks up a new PocketBase image happens separately.

> [!WARNING]
> A commit that touches only `pb_migrations/**` fires both workflows in parallel with no ordering between them. `deploy.yml` isn't path-filtered against `pb_migrations/**`, so its (much faster) redeploy can fire while `deploy-pocketbase.yml`'s image push is still in flight, which would leave the running `pocketbase` service on the previous image/migration set until the next unrelated push. There's no `workflow_run` gate enforcing build-before-redeploy order between the two workflows today.

---

## 5. Local Development Workflow

### 1. Download & Launch PocketBase
```bash
# Download PocketBase (v0.27.2+)
curl -L https://github.com/pocketbase/pocketbase/releases/download/v0.27.2/pocketbase_0.27.2_linux_amd64.zip -o pocketbase.zip
unzip pocketbase.zip pocketbase

# Start PocketBase server (auto-applies pb_migrations/)
./pocketbase serve
```

### 2. Bootstrap Local Superuser
On first startup, create a superuser account:
```bash
./pocketbase superuser upsert admin@local.test password123456
```

### 3. Setup Environment Variables
Create `.env.local`:
```bash
PB_URL=http://127.0.0.1:8090
PB_SUPERUSER_EMAIL=admin@local.test
PB_SUPERUSER_PASSWORD=password123456
APP_URL=http://localhost:3000

# Optional Provider Credentials
TMDB_API_KEY=your_tmdb_bearer_token
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### 4. Install & Run Dev Server
```bash
bun install
bun run dev
```

---

## 6. Production PocketBase Admin UI Setup

Once PocketBase is deployed at `https://pb.hepyeni.net/_/`:

1. **Google OAuth2 Setup**:
   - Navigate to **Settings $\to$ Auth Providers $\to$ Google**.
   - Enable provider and enter **Client ID** and **Client Secret**.
   - Set Redirect URI in Google Cloud Console to: `https://hepyeni.net/api/auth/oauth2-callback`.
2. **Mail (SMTP) Setup**:
   - Navigate to **Settings $\to$ Mail Settings**.
   - Enable SMTP and enter server host (e.g. `smtp.purelymail.com`), port (`465` SSL), user, and password.
   - Set sender email to: `Titirek <noreply@hepyeni.net>`.
