FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# `next build` collects page data by importing route modules (including
# src/db/index.ts, which uses Bun's native `SQL` client) — must run under
# Bun's runtime, not Node, or it fails with "Cannot find module 'bun'".
#
# Bun 1.3.14 has a reproducible engine bug: after the build finishes
# successfully (route summary printed, .next/standalone written), Bun's own
# process segfaults on exit ("Bun has crashed... file a GitHub issue" —
# Bun's own crash reporter, not an app error), giving a false-failure exit
# code. Gate on the actual build artifact instead of the process exit code;
# if the build genuinely failed, the artifact won't exist and this still
# fails the step correctly. Revisit once upstream fixes the crash.
RUN bun --bun next build; test -f .next/standalone/server.js

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "run", "server.js"]
