import { extractCv } from "./portfolio-import.js";
import { aiRequest, interviewResponse } from "./ai-client.js";
import "reflect-metadata";
import "./config.js";
import { NestFactory } from "@nestjs/core";
import {
  Module,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  Inject,
  BadRequestException,
  ServiceUnavailableException,
  NotFoundException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  json as bodyJson,
  urlencoded,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Document, Packer, Paragraph, TextRun } from "docx";

import { z } from "zod";
import { AppService, db, json } from "./service.js";
import { apiOrigin, webOrigin, required, ownerEmail } from "./config.js";
import { isOwner } from "./auth.js";
import { seal } from "./security.js";
import { renderPdf } from "./pdf-render.js";

import { uploadAsset, assetUrl, localAsset, publishedAsset } from "./assets.js";
import { connectLinkedIn, callbackLinkedIn } from "./linkedin.js";
import type { Portfolio, Profile, Job } from "@jobnester/core";
const pdfBuffer = (text: string) => renderPdf("Professional document", text);
async function documentResponse(
  res: Response,
  text: string,
  format: string,
  name: string,
) {
  res.setHeader("Cache-Control", "private, no-store");
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safe}.${format === "docx" ? "docx" : "pdf"}"`,
  );
  if (format === "docx") {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: text.split("\n").map(
            (line, i) =>
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: line,
                    font: "Arial",
                    size: i === 0 ? 36 : 21,
                    bold: i === 0 || ["SKILLS", "EXPERIENCE"].includes(line),
                  }),
                ],
              }),
          ),
        },
      ],
    });
    res
      .type(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      )
      .send(await Packer.toBuffer(doc));
  } else res.type("application/pdf").send(await pdfBuffer(text));
}
function cookies(req: Request) {
  return Object.fromEntries(
    (req.headers.cookie || "").split(";").map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i).trim(), decodeURIComponent(x.slice(i + 1))];
    }),
  );
}
@Controller("api")
class AppController {
  constructor(@Inject(AppService) private readonly service: AppService) {}
  @Get("health") health() {
    return { status: "ok", service: "jobnester-api" };
  }
  @Get("state") state() {
    return this.service.state();
  }
  @Post("actions/:action") action(
    @Param("action") action: string,
    @Body() data: unknown,
  ) {
    return this.service.action(action, data);
  }
  @Get("tasks/:id") task(@Param("id") id: string) {
    return db.task.findUniqueOrThrow({ where: { id } });
  }
  @Post("resume/import")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
      fileFilter(_req, file, cb) {
        cb(null, /\.(txt|pdf|docx)$/i.test(file.originalname));
      },
    }),
  )
  async import(@UploadedFile() file: Express.Multer.File) {
    return { text: await extractCv(file), reviewRequired: true };
  }

  @Post("assets/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return uploadAsset(file);
  }
  @Get("assets/:id") async asset(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const file = await localAsset(id);
    if (file) {
      res.type(file.asset.mime).setHeader("X-Content-Type-Options", "nosniff");
      res.send(file.buffer);
    } else res.redirect(await assetUrl(id, false));
  }
  @Get("public/assets/:id") async publicAsset(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    await publishedAsset(id);
    const file = await localAsset(id);
    if (file) {
      res.type(file.asset.mime).setHeader("X-Content-Type-Options", "nosniff");
      res.send(file.buffer);
    } else res.redirect(await assetUrl(id, true));
  }
  @Get("resumes/:id/download") async download(
    @Param("id") id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const r = await db.resume.findUniqueOrThrow({ where: { id } });
    await documentResponse(
      res,
      req.query.kind === "cover" ? r.coverLetter : r.content,
      String(req.query.format),
      r.name,
    );
  }
  @Get("portfolio/draft") async portfolioDraft() {
    return (await this.service.owner()).portfolioDraft;
  }
  @Post("portfolio/from-cv")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async portfolioFromCv(@UploadedFile() file: Express.Multer.File) {
    const text = await extractCv(file);
    const generated = await aiRequest(
      "/v1/portfolio/from-cv",
      { text, useAi: true },
      z.object({
        name: z.string(),
        headline: z.string(),
        bio: z.string(),
        email: z.string(),
        github: z.string(),
        skills: z.array(z.string()),
        experience: z.array(z.any()),
        certifications: z.array(z.any()),
        projects: z.array(z.any()),
        reviewRequired: z.boolean(),
        extractedText: z.string(),
        method: z.string().optional(),
      }),
    );
    const upload = await uploadAsset(file);
    return {
      ...generated,
      resume: { url: upload.url, name: file.originalname },
    };
  }
  @Get("public/portfolio") async publicPortfolio() {
    const owner = await this.service.owner();
    if (!owner.portfolioPublished)
      throw new NotFoundException("Portfolio not published");
    return owner.portfolioPublished;
  }
  @Get("public/resume") async publicResume(@Res() res: Response) {
    const owner = await this.service.owner();
    const p = owner.portfolioPublished as unknown as Portfolio | null;
    if (p?.resume?.url) {
      res.redirect(p.resume.url);
      return;
    }
    if (!p?.publicResumeId) throw new NotFoundException("No public resume");
    const r = await db.resume.findFirst({
      where: { id: p.publicResumeId, ready: true },
    });
    if (!r) throw new NotFoundException();
    await documentResponse(res, r.content, "pdf", `${p.name}-CV`);
  }
  @Post("public/contact") async contact(@Body() body: unknown) {
    const data = z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.email().max(200),
        message: z.string().trim().min(10).max(5000),
        website: z.string().max(200).optional(),
      })
      .safeParse(body);
    if (!data.success)
      throw new BadRequestException(
        "Enter your name, email, and a message between 10 and 5,000 characters.",
      );
    if (data.data.website) return { ok: true };
    const owner = await this.service.owner();
    if (!owner.portfolioPublished)
      throw new NotFoundException("Portfolio not published");
    const recipient =
      owner.contactRecipient ||
      process.env.CONTACT_NOTIFY_EMAIL ||
      process.env.OWNER_EMAIL;
    if (
      !recipient ||
      !process.env.CONTACT_FROM_EMAIL ||
      (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST)
    )
      throw new ServiceUnavailableException(
        "Email delivery is not configured. Please use the published email link.",
      );
    const { website, ...inquiry } = data.data;
    const record = await db.inquiry.create({ data: inquiry });
    await this.service.task("notify", { inquiryId: record.id });
    return { ok: true, emailStatus: "queued" };
  }

  @Get("interview/:id") async interview(@Param("id") id: string) {
    const [record, owner] = await Promise.all([
      db.job.findUniqueOrThrow({ where: { id } }),
      this.service.owner(),
    ]);
    const job = record.payload as unknown as Job;
    const p = owner.profile as unknown as Profile;
    try {
      return await aiRequest(
        "/v1/interviews/prepare",
        { profile: p, job },
        interviewResponse,
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : "AI service unavailable",
      );
    }
  }

  @Get("integrations/linkedin/connect") linkedinConnect(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return connectLinkedIn(res, req.headers.accept === "application/json");
  }
  @Get("integrations/linkedin/callback") linkedinCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return callbackLinkedIn(req, res);
  }
  @Get("integrations/gmail/connect") async gmailConnect(
    @Req() req: Request,
    @Res() res: Response,
  ) {
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
  @Get("integrations/gmail/callback") async gmailCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
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
@Module({ controllers: [AppController], providers: [AppService] })
class AppModule {}
async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const express = app.getHttpAdapter().getInstance();
  if (process.env.TRUST_PROXY === "1") express.set("trust proxy", 1);
  app.use(helmet());
  app.enableCors({
    origin: [
      webOrigin,
      ...(process.env.PUBLIC_PORTFOLIO_ORIGINS || "")
        .split(",")
        .filter(Boolean),
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
  });
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(
    "/api/public/contact",
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 5,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(bodyJson({ limit: "2mb" }));
  app.use(urlencoded({ extended: false, limit: "100kb" }));

  app.use(async (req: Request, res: Response, next: () => void) => {
    if (
      req.method === "OPTIONS" ||
      req.path === "/api/health" ||
      (req.method === "GET" &&
        [
          "/api/integrations/gmail/callback",
          "/api/integrations/linkedin/callback",
        ].includes(req.path)) ||
      req.path.startsWith("/api/public/")
    )
      return next();
    if (!(await isOwner(req)))
      return res
        .status(401)
        .json({ message: "Sign in with the configured owner account." });
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers.origin !== webOrigin
    )
      return res
        .status(403)
        .json({ message: "Request origin is not allowed." });
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  await app.listen(Number(process.env.PORT) || 4000, "0.0.0.0");
  console.log(`JobNester API: ${apiOrigin}`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "API startup failed");
  process.exit(1);
});
