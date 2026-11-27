import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { apiOrigin, webOrigin } from "../../config/index.js";
import { db } from "../../common/prisma.js";
import { seal } from "../../common/security.js";
export async function connectLinkedIn(res: Response, asJson = false) {
  if (
    !process.env.LINKEDIN_CLIENT_ID ||
    !process.env.LINKEDIN_CLIENT_SECRET ||
    !process.env.TOKEN_ENCRYPTION_KEY
  )
    throw new ServiceUnavailableException(
      "Configure LinkedIn OpenID Connect credentials and TOKEN_ENCRYPTION_KEY first.",
    );
  const state = randomBytes(32).toString("hex");
  res.cookie("linkedin_state", state, {
    httpOnly: true,
    secure: apiOrigin.startsWith("https:"),
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/api/integrations/linkedin",
  });
  const url =
    "https://www.linkedin.com/oauth/v2/authorization?" +
    new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: `${apiOrigin}/api/integrations/linkedin/callback`,
      scope: "openid profile email",
      state,
    });
  if (asJson) res.json({ url });
  else res.redirect(url);
}
export async function callbackLinkedIn(req: Request, res: Response) {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .find((s) => s.trim().startsWith("linkedin_state="))
    ?.trim()
    .slice("linkedin_state=".length);
  const actual = String(req.query.state || "");
  res.clearCookie("linkedin_state", { path: "/api/integrations/linkedin" });
  if (
    !cookie ||
    cookie.length !== actual.length ||
    !timingSafeEqual(Buffer.from(cookie), Buffer.from(actual))
  )
    throw new BadRequestException(
      "LinkedIn OAuth state is invalid or expired. Reconnect.",
    );
  if (req.query.error || !req.query.code)
    throw new BadRequestException("LinkedIn access was not granted.");
  const tokenResponse = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(req.query.code),
        client_id: process.env.LINKEDIN_CLIENT_ID || "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
        redirect_uri: `${apiOrigin}/api/integrations/linkedin/callback`,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const token = (await tokenResponse.json()) as any;
  if (!tokenResponse.ok || !token.access_token)
    throw new BadRequestException(
      "LinkedIn token exchange failed. Check the approved product and callback URL.",
    );
  const userResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(15000),
  });
  const profile = (await userResponse.json()) as any;
  if (!userResponse.ok || !profile.sub)
    throw new BadRequestException("Could not read basic LinkedIn profile.");
  const encryptedTokens = seal({
    access_token: token.access_token,
    expiresAt: Date.now() + Number(token.expires_in) * 1000,
    identity: {
      name: profile.name,
      email: profile.email_verified ? profile.email : undefined,
    },
  });
  await db.integration.upsert({
    where: { provider: "linkedin" },
    update: { encryptedTokens },
    create: { provider: "linkedin", encryptedTokens },
  });
  res.redirect(`${webOrigin}/`);
}
