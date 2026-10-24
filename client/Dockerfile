# Build context is the repo root: the client bundles packages/contracts (file:).
#   docker build -f client/Dockerfile .

# Both stages share the Debian base with the server image: it keeps the build and the runtime
# on the same libc (native Next/sharp binaries) instead of mixing glibc and musl.
# ---- contracts -------------------------------------------------------------
FROM node:22-slim AS contracts
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
WORKDIR /app/packages/contracts
RUN npm ci --no-audit --no-fund && npm run build

# ---- build -----------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
COPY --from=contracts /app/packages/contracts ./packages/contracts
COPY tsconfig.base.json ./
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm ci
# Baked into the client bundle at build time (same-domain proxying via Caddy in compose).
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SOCKET_PATH=/api/socket.io
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_SOCKET_PATH=$NEXT_PUBLIC_SOCKET_PATH
COPY client ./
RUN npm run build

# ---- runtime ---------------------------------------------------------------
FROM node:22-slim
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
# The trace root is the repo root, so the standalone bundle mirrors it: /app/client/server.js.
COPY --from=build --chown=node:node /app/client/.next/standalone ./
COPY --from=build --chown=node:node /app/client/.next/static ./client/.next/static
COPY --from=build --chown=node:node /app/client/public ./client/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "client/server.js"]
