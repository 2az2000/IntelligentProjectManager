# Build context is the repo root: the server depends on packages/contracts (file:).
#   docker build -f server/Dockerfile .

# ---- contracts -------------------------------------------------------------
# Built in its own stage: the app's `npm ci` only links the package, it does not build it.
FROM node:22-slim AS contracts
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
WORKDIR /app/packages/contracts
RUN npm ci --no-audit --no-fund && npm run build

# ---- build -----------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
# Prisma engines need the OpenSSL shared library on Debian.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=contracts /app/packages/contracts ./packages/contracts
COPY tsconfig.base.json ./
WORKDIR /app/server
COPY server/package*.json ./
# The postinstall hook runs `prisma generate`, so the schema must be here before `npm ci`.
COPY server/prisma ./prisma
COPY server/prisma.config.ts ./
RUN npm ci
COPY server/tsconfig*.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime ---------------------------------------------------------------
FROM node:22-slim
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
# Same tree as the build stage (/app/server + /app/packages): npm links the workspace package
# with a *relative* symlink (node_modules/@managesys/contracts -> ../../../packages/contracts),
# so moving the app to /app/node_modules would leave that link dangling.
WORKDIR /app
COPY --from=build /app/packages/contracts ./packages/contracts
WORKDIR /app/server
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
# Prisma 7 CLI reads DATABASE_URL from this config (the schema has no url block).
COPY --from=build /app/server/prisma.config.ts ./
COPY --from=build /app/server/package.json ./
# Attachment storage lives on a volume; ownership goes to the non-root user.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
ENV UPLOAD_DIR=/app/uploads PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Schema migrations run before the server accepts traffic.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
