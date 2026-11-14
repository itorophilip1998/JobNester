import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
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
