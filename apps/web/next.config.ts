import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
const config: NextConfig = {
  ...(process.env.WEB_OUTPUT === "export" ? { output: "export" as const } : {}),
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    if (process.env.WEB_OUTPUT === "export")
      config.resolve.alias = {
        ...config.resolve.alias,
        "@clerk/nextjs$": fileURLToPath(
          new URL("./app/static-demo/clerk-client.tsx", import.meta.url),
        ),
        "@clerk/nextjs/server$": fileURLToPath(
          new URL("./app/static-demo/clerk-server.ts", import.meta.url),
        ),
      };
    return config;
  },
  transpilePackages: ["@jobnester/core"],
  poweredByHeader: false,
  devIndicators: false,
};
export default config;
