# Sync server image. Build from the repo root:
#   docker build -f apps/sync/Dockerfile -t whiteboard-sync .
# Node 24 runs the TypeScript sources directly (type stripping), so there is no
# compile step; `pnpm build` only type-checks. See docs/decisions.md.
FROM node:24-slim
RUN corepack enable
WORKDIR /app

# Install dependencies for the sync app and the workspace packages it uses.
# Copy only manifests first so this layer is cached until dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/sync/package.json apps/sync/
COPY packages/db/package.json packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@whiteboard/sync..."

# Source, then generate the Prisma client and type-check.
COPY packages/db packages/db
COPY packages/shared packages/shared
COPY apps/sync apps/sync
RUN pnpm --filter @whiteboard/db generate && pnpm --filter @whiteboard/sync build

ENV NODE_ENV=production
EXPOSE 1234
WORKDIR /app/apps/sync
CMD ["node", "src/index.ts"]
