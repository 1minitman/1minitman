# One Dockerfile for both Bun services. Build from the repo root:
#   docker build -f infra/docker/service.Dockerfile --build-arg SERVICE=api -t 1minitman-api .
#   docker build -f infra/docker/service.Dockerfile --build-arg SERVICE=worker -t 1minitman-worker .
ARG BUN_VERSION=1.4.5

FROM node:24-slim AS build
ARG SERVICE
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1 HUSKY=0
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/${SERVICE}/package.json apps/${SERVICE}/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/entitlements/package.json packages/entitlements/
COPY packages/i18n/package.json packages/i18n/
RUN pnpm install --frozen-lockfile --filter "@1minitman/${SERVICE}..."
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/${SERVICE} apps/${SERVICE}
# Bundles the service and its workspace packages into one file.
RUN pnpm --filter "@1minitman/${SERVICE}" build

FROM oven/bun:${BUN_VERSION}-slim AS run
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/${SERVICE}/dist ./dist
USER bun
EXPOSE 4000
CMD ["bun", "dist/main.js"]
