# NotifyForge API + Worker container image
# Multi-stage build: install deps → build → runtime

# ---- build stage ----
FROM oven/bun:1.1-alpine AS build
WORKDIR /app

# Install deps (cached layer)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production=false

# Build the app
COPY . .
RUN bun run build

# Prune dev deps for the runtime image
RUN bun install --frozen-lockfile --production

# ---- runtime stage ----
FROM oven/bun:1.1-alpine AS runtime
WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Copy built artifacts
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["bun", ".next/standalone/server.js"]
