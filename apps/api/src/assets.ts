import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { inspectDocx } from "./documents.js";
import { publicAssetReferences } from "@jobnester/core";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ServiceUnavailableException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { db } from "./service.js";
import { apiOrigin } from "./config.js";
import type { Portfolio } from "@jobnester/core";
function storage() {
  if (!process.env.S3_BUCKET)
    throw new ServiceUnavailableException(
      "Media storage is not configured. Set S3_BUCKET and AWS credentials, or use HTTPS media URLs.",
    );
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });
}
export async function uploadAsset(file: Express.Multer.File) {
  if (!file)
    throw new BadRequestException(
      "Choose a PNG, JPEG, WebP, or MP4 file under 20 MB.",
    );
  const b = file.buffer;
  const mime = b
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : b[0] === 255 && b[1] === 216 && b[2] === 255
      ? "image/jpeg"
      : b.subarray(0, 4).toString() === "RIFF" &&
          b.subarray(8, 12).toString() === "WEBP"
        ? "image/webp"
        : b.subarray(4, 8).toString() === "ftyp"
          ? "video/mp4"
          : b.subarray(0, 5).toString() === "%PDF-"
            ? "application/pdf"
            : /\.docx$/i.test(file.originalname)
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : /\.txt$/i.test(file.originalname)
                ? "text/plain"
                : null;
  if (!mime)
    throw new BadRequestException("Unsupported or invalid media format.");
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    inspectDocx(b);
  const id = randomUUID();
  const local = process.env.ASSET_STORAGE !== "s3";
  const key = local ? `local/${id}` : `portfolio/${id}`;
  if (local) {
    const dir = process.env.UPLOAD_DIRECTORY || "/tmp/jobnester-uploads";
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, id), b, { mode: 0o600 });
  } else {
    const s3 = storage();
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: b,
        ContentType: mime,
        ContentDisposition: "inline",
      }),
    );
  }
  await db.asset.create({
    data: { id, key, mime, originalName: file.originalname.slice(0, 200) },
  });
  return { id, url: `${apiOrigin}/api/public/assets/${id}`, mime };
}
export async function assetUrl(id: string, publicOnly: boolean) {
  if (publicOnly) {
    const owner = await db.owner.findUnique({ where: { id: "owner" } });
    const p = owner?.portfolioPublished as unknown as Portfolio | null;
    const url = `${apiOrigin}/api/public/assets/${id}`;
    if (!p || !publicAssetReferences(p).includes(url))
      throw new NotFoundException("This media is not published.");
  }
  const a = await db.asset.findUnique({ where: { id } });
  if (!a) throw new NotFoundException();
  return getSignedUrl(
    storage(),
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: a.key,
      ResponseContentType: a.mime,
    }),
    { expiresIn: 60 },
  );
}

export async function localAsset(id: string) {
  const a = await db.asset.findUnique({ where: { id } });
  if (!a) throw new NotFoundException();
  if (!a.key.startsWith("local/")) return null;
  const filename = a.key.slice(6);
  if (!/^[a-f0-9-]{36}$/.test(filename)) throw new NotFoundException();
  return {
    asset: a,
    buffer: await readFile(
      join(process.env.UPLOAD_DIRECTORY || "/tmp/jobnester-uploads", filename),
    ),
  };
}
export async function publishedAsset(id: string) {
  const owner = await db.owner.findUnique({ where: { id: "owner" } });
  const p = owner?.portfolioPublished as unknown as Portfolio | null;
  if (
    !p ||
    !publicAssetReferences(p).includes(`${apiOrigin}/api/public/assets/${id}`)
  )
    throw new NotFoundException("This file is not published.");
}
