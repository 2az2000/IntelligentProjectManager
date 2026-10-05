import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Phase 6: self-contained production bundle for the Docker runtime image.
  output: "standalone",
};

export default withNextIntl(nextConfig);
