# ── Stage 1: Install all deps ─────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/backend/package.json ./apps/backend/

RUN npm ci

# ── Stage 2: Build database package ───────────────────────────────────────────
FROM deps AS db-builder
COPY packages/database/src ./packages/database/src
COPY packages/database/tsconfig.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma

RUN cd packages/database && npm run generate && npm run build

# ── Stage 3: Build backend ─────────────────────────────────────────────────────
FROM db-builder AS backend-builder
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/tsconfig.json ./apps/backend/

RUN cd apps/backend && npm run build

# ── Stage 4: Production runner ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# wget for healthcheck
RUN apk add --no-cache wget

ENV NODE_ENV=production

# Run as non-root
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy all node_modules (root hoisted + any workspace-local)
COPY --from=deps /app ./

# Copy built artifacts + static assets (fonts for PDF generation)
COPY --from=backend-builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=backend-builder /app/apps/backend/src/assets ./apps/backend/dist/assets
COPY --from=backend-builder /app/apps/backend/tsconfig.json ./apps/backend/
COPY --from=db-builder /app/packages/database/dist ./packages/database/dist

# Prisma client (generated)
COPY --from=db-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=db-builder /app/packages/database/prisma ./packages/database/prisma

RUN chown -R appuser:appgroup /app

USER appuser

WORKDIR /app/apps/backend
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "-r", "tsconfig-paths/register", "dist/server.js"]
