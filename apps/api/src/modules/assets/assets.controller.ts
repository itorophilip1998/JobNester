import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import {
  uploadAsset,
  assetUrl,
  localAsset,
  publishedAsset,
} from "./assets.js";

@Controller("api")
export class AssetsController {
  @Post("assets/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return uploadAsset(file);
  }

  @Get("assets/:id")
  async asset(@Param("id") id: string, @Res() res: Response) {
    res.setHeader("Cache-Control", "no-store");
    const file = await localAsset(id);
    if (file) {
      res.type(file.asset.mime).setHeader("X-Content-Type-Options", "nosniff");
      res.send(file.buffer);
    } else res.redirect(await assetUrl(id, false));
  }

  @Get("public/assets/:id")
  async publicAsset(@Param("id") id: string, @Res() res: Response) {
    res.setHeader("Cache-Control", "no-store");
    await publishedAsset(id);
    const file = await localAsset(id);
    if (file) {
      res.type(file.asset.mime).setHeader("X-Content-Type-Options", "nosniff");
      res.send(file.buffer);
    } else res.redirect(await assetUrl(id, true));
  }
}
