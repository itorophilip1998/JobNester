import "reflect-metadata";
import "./config/index.js";
import { NestFactory } from "@nestjs/core";
import {
  json as bodyJson,
  urlencoded,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { AppModule } from "./app.module.js";
import { apiOrigin, webOrigin } from "./config/index.js";
import { isOwner } from "./modules/auth/index.js";

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
