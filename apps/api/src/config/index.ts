import { config, parse } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
config({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
} as any);
export const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";
export const apiOrigin = process.env.API_ORIGIN || "http://localhost:4000";
export const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
export const redisConnection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
  maxRetriesPerRequest: null,
};
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

// Clerk CLI initializes the Next.js workspace. Reuse those exact development keys locally.
const clerkEnv = fileURLToPath(
  new URL("../../../web/.env.local", import.meta.url),
);
if (existsSync(clerkEnv)) {
  const values = parse(readFileSync(clerkEnv));
  for (const key of ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"])
    if (!process.env[key] && values[key]) process.env[key] = values[key];
}
