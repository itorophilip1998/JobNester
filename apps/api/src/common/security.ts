import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { required } from "../config/index.js";
function key() {
  const k = Buffer.from(required("TOKEN_ENCRYPTION_KEY"), "hex");
  if (k.length !== 32)
    throw Error("TOKEN_ENCRYPTION_KEY must contain 64 hexadecimal characters");
  return k;
}
export function seal(data: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64"))
    .join(".");
}
export function unseal<T>(data: string): T {
  const [iv, tag, encrypted] = data
    .split(".")
    .map((s) => Buffer.from(s, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(encrypted), cipher.final()]).toString("utf8"),
  );
}
