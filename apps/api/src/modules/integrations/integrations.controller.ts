import {
  BadRequestException,
  Controller,
  Get,
  Req,
  Res,
} from "@nestjs/common";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import {
  apiOrigin,
  webOrigin,
  required,
  ownerEmail,
} from "../../config/index.js";
import { db } from "../../common/prisma.js";
import { seal } from "../../common/security.js";
import { connectLinkedIn, callbackLinkedIn } from "./linkedin.js";

function cookies(req: Request) {
  return Object.fromEntries(
    (req.headers.cookie || "").split(";").map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i).trim(), decodeURIComponent(x.slice(i + 1))];
    }),
  );
}

@Controller("api")
export class IntegrationsController {
  @Get("integrations/linkedin/connect")
  linkedinConnect(@Req() req: Request, @Res() res: Response) {
    return connectLinkedIn(res, req.headers.accept === "application/json");
  }

  @Get("integrations/linkedin/callback")
  linkedinCallback(@Req() req: Request, @Res() res: Response) {
    return callbackLinkedIn(req, res);
  }

  @Get("integrations/gmail/connect")
  async gmailConnect(@Req() req: Request, @Res() res: Response) {
    required("GOOGLE_CLIENT_ID");
    required("GOOGLE_CLIENT_SECRET");
    required("TOKEN_ENCRYPTION_KEY");
    const state = randomBytes(32).toString("hex");
    res.cookie("gmail_state", state, {
      httpOnly: true,
      secure: apiOrigin.startsWith("https:"),
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/api/integrations/gmail",
    });
    const params = new URLSearchParams({
      client_id: required("GOOGLE_CLIENT_ID"),
      redirect_uri: `${apiOrigin}/api/integrations/gmail/callback`,
      response_type: "code",
      scope:
        "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
      access_type: "offline",
      prompt: "consent",
      state,
      login_hint: ownerEmail || "",
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    if (req.headers.accept === "application/json") res.json({ url });
    else res.redirect(url);
  }

  @Get("integrations/gmail/callback")
  async gmailCallback(@Req() req: Request, @Res() res: Response) {
    const expected = cookies(req).gmail_state;
    res.clearCookie("gmail_state", { path: "/api/integrations/gmail" });
    const actual = String(req.query.state || "");
    if (
      !expected ||
      expected.length !== actual.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
    )
      throw new BadRequestException(
        "Invalid or expired OAuth state. Reconnect Gmail.",
      );
    if (req.query.error || !req.query.code)
      throw new BadRequestException("Gmail authorization was declined.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: required("GOOGLE_CLIENT_ID"),
        client_secret: required("GOOGLE_CLIENT_SECRET"),
        code: String(req.query.code),
        grant_type: "authorization_code",
        redirect_uri: `${apiOrigin}/api/integrations/gmail/callback`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const tokens = (await response.json()) as any;
    if (!response.ok || !tokens.refresh_token)
      throw new BadRequestException(
        "Gmail token exchange failed. Reconnect and grant offline access.",
      );
    const identityResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    const identity = (await identityResponse.json()) as any;
    if (
      !identityResponse.ok ||
      identity.email?.toLowerCase() !== ownerEmail ||
      !identity.email_verified
    )
      throw new BadRequestException("Connect the owner’s Gmail account.");
    await db.integration.upsert({
      where: { provider: "gmail" },
      update: {
        encryptedTokens: seal({
          ...tokens,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        }),
      },
      create: {
        provider: "gmail",
        encryptedTokens: seal({
          ...tokens,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        }),
      },
    });
    res.redirect(`${webOrigin}/`);
  }
}
