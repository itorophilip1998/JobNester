import { BadRequestException } from "@nestjs/common";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { inspectDocx } from "./documents.js";
export async function extractCv(file: Express.Multer.File): Promise<string> {
  if (!file || file.size > 5 * 1024 * 1024)
    throw new BadRequestException("Upload a PDF, DOCX, or TXT CV under 5 MB.");
  let text = "";
  try {
    if (/\.pdf$/i.test(file.originalname)) {
      if (file.buffer.subarray(0, 5).toString() !== "%PDF-") throw Error();
      const parser = new PDFParse({
        data: new Uint8Array(file.buffer),
        isEvalSupported: false,
      });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else if (/\.docx$/i.test(file.originalname)) {
      inspectDocx(file.buffer);
      text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
    } else if (/\.txt$/i.test(file.originalname))
      text = file.buffer.toString("utf8");
    else throw Error();
  } catch {
    throw new BadRequestException(
      "Could not read this CV. Use a text-based PDF, DOCX, or TXT file.",
    );
  }
  if (text.trim().length < 20 || text.length > 100000)
    throw new BadRequestException(
      "CV must contain readable text between 20 and 100,000 characters.",
    );
  return text;
}
