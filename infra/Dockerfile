# Zone Dockerfile — Multi-stage build for all services

# ─── Base ───
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ─── Dependencies ───
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/ws/package.json ./apps/ws/
COPY apps/worker/package.json ./apps/worker/
COPY packages/core/package.json ./packages/core/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/db/package.json ./packages/db/
COPY packages/redis/package.json ./packages/redis/
COPY packages/tags/package.json ./packages/tags/
COPY packages/assistant/package.json ./packages/assistant/
COPY packages/voice/package.json ./packages/voice/
COPY plugins/services/package.json ./plugins/services/
COPY plugins/social/package.json ./plugins/social/
COPY plugins/support/package.json ./plugins/support/
COPY plugins/professional/package.json ./plugins/professional/
COPY plugins/verification/package.json ./plugins/verification/
RUN pnpm install --frozen-lockfile

# ─── Build ───
FROM deps AS build
COPY . .
RUN pnpm run build

# ─── API ───
FROM build AS api
CMD ["node", "apps/api/dist/index.js"]

# ─── WebSocket ───
FROM build AS ws
CMD ["node", "apps/ws/dist/index.js"]

# ─── Worker ───
FROM build AS worker
CMD ["node", "apps/worker/dist/index.js"]
