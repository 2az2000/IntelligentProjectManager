import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Phase 6: self-contained production bundle for the Docker runtime image.
  output: "standalone",
  // Phase 8: `@managesys/contracts` is a symlinked workspace package one level up. Pointing
  // Turbopack at the repo root lets it resolve both the package and the shared tsconfig base;
  // transpilePackages compiles the package's TS declarations for the client.
  transpilePackages: ["@managesys/contracts"],
  // This also makes the repo root the file-tracing root, so `.next/standalone` mirrors the
  // monorepo layout (`standalone/client/server.js`) — the Dockerfile copies it that way.
  turbopack: { root: path.join(__dirname, "..") },
};

export default withNextIntl(nextConfig);
