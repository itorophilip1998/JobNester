import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { db } from "../../common/prisma.js";
import { extractCv } from "../../documents/portfolio-import.js";
import { documentResponse } from "../../documents/document-response.js";

@Controller("api")
export class ResumesController {
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

  @Get("resumes/:id/download")
  async download(
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
}
