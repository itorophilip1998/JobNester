import "./config.js";
import { Auth, type AuthConfig } from "@auth/core";
import Google from "@auth/core/providers/google";
import { apiOrigin, webOrigin, ownerEmail, required } from "./config.js";
import type { Request, Response } from "express";
export const authConfig: AuthConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  basePath: "/api/auth",
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  callbacks: {
    async signIn({ user, profile }) {
      return (
        !!ownerEmail &&
        user.email?.toLowerCase() === ownerEmail &&
        (profile as any)?.email_verified === true
      );
    },
    async redirect({ url }) {
      return url.startsWith(webOrigin + "/") || url === webOrigin
        ? url
        : webOrigin;
    },
  },
  logger: {
    error(error) {
      console.error("Authentication error:", error.name);
    },
    warn(code) {
      console.warn("Authentication warning:", code);
    },
    debug() {},
  },
};
export function webRequest(req: Request, path?: string) {
  const headers = new Headers();
  for (const [key, v] of Object.entries(req.headers)) {
    if (v) headers.set(key, Array.isArray(v) ? v.join(",") : v);
  }
  const method = path ? "GET" : req.method;
  let body: string | undefined;
  if (!["GET", "HEAD"].includes(method))
    body =
      typeof req.body === "string"
        ? req.body
        : new URLSearchParams(req.body || {}).toString();
  return new Request(`${apiOrigin}${path || req.originalUrl}`, {
    method,
    headers,
    body,
  });
}
export async function authHandler(req: Request, res: Response) {
  try {
    required("AUTH_SECRET");
    required("OWNER_EMAIL");
    required("GOOGLE_CLIENT_ID");
    required("GOOGLE_CLIENT_SECRET");
    const r = await Auth(webRequest(req), authConfig);
    for (const [k, v] of r.headers) {
      if (k !== "set-cookie") res.setHeader(k, v);
    }
    const cookies = r.headers.getSetCookie();
    if (cookies.length) res.setHeader("set-cookie", cookies);
    res.status(r.status).send(Buffer.from(await r.arrayBuffer()));
  } catch {
    res
      .status(503)
      .json({
        message:
          "Owner authentication is not configured. Set OWNER_EMAIL, AUTH_SECRET, and Google OAuth credentials.",
      });
  }
}
export async function isOwner(req: Request) {
  if (!ownerEmail || !process.env.AUTH_SECRET) return false;
  try {
    const r = await Auth(webRequest(req, "/api/auth/session"), authConfig);
    const session = (await r.json()) as any;
    return session?.user?.email?.toLowerCase() === ownerEmail;
  } catch {
    return false;
  }
}
