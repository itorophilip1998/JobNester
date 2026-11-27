import type { Response } from "express";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { renderPdf } from "./pdf-render.js";

const pdfBuffer = (text: string) => renderPdf("Professional document", text);

export async function documentResponse(
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
