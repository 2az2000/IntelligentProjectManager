# ---- build -----------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
# Prisma engines need the OpenSSL shared library on Debian.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime ---------------------------------------------------------------
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# Prisma 7 CLI reads DATABASE_URL from this config (the schema has no url block).
COPY prisma.config.ts ./
COPY package.json ./
# Attachment storage lives on a volume; ownership goes to the non-root user.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
ENV UPLOAD_DIR=/app/uploads PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Schema migrations run before the server accepts traffic.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
