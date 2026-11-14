import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
const config: NextConfig = {
  output: "export",
  transpilePackages: ["@jobnester/core"],
  poweredByHeader: false,
  devIndicators: false,
};
export default config;
