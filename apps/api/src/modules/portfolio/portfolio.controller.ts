import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Post,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { z } from "zod";
import type { Portfolio } from "@jobnester/core";
import { AppService } from "../workspace/workspace.service.js";
import { db } from "../../common/prisma.js";
import { extractCv } from "../../documents/portfolio-import.js";
import { documentResponse } from "../../documents/document-response.js";
import { uploadAsset } from "../assets/assets.js";
import { aiRequest } from "../../ai/ai-client.js";

@Controller("api")
export class PortfolioController {
  constructor(@Inject(AppService) private readonly service: AppService) {}

  @Get("portfolio/draft")
  async portfolioDraft() {
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

  @Get("public/portfolio")
  async publicPortfolio() {
    const owner = await this.service.owner();
    if (!owner.portfolioPublished)
      throw new NotFoundException("Portfolio not published");
    return owner.portfolioPublished;
  }

  @Get("public/resume")
  async publicResume(@Res() res: Response) {
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

  @Post("public/contact")
  async contact(@Body() body: unknown) {
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
}
