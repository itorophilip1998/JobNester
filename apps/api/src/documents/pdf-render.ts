/** HTML → PDF via Playwright when available; improved pdfkit fallback otherwise. */
import PDFDocument from "pdfkit";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function documentHtml(title: string, text: string) {
  const blocks = text.split("\n").map((line, i) => {
    const safe = escapeHtml(line || " ");
    if (i === 0) return `<h1>${safe}</h1>`;
    if (/^(SKILLS|EXPERIENCE|COVER LETTER|SUMMARY)$/i.test(line.trim()))
      return `<h2>${safe}</h2>`;
    return `<p>${safe}</p>`;
  });
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #15202b; font-size: 11pt; line-height: 1.45; }
  h1 { font-size: 20pt; margin: 0 0 10pt; letter-spacing: -0.02em; }
  h2 { font-size: 11pt; margin: 16pt 0 6pt; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #d7dde5; padding-bottom: 4pt; }
  p { margin: 0 0 4pt; white-space: pre-wrap; }
</style></head><body>${blocks.join("")}</body></html>`;
}

async function playwrightPdf(html: string): Promise<Buffer | null> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "16mm", right: "14mm", bottom: "16mm", left: "14mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

function pdfkitFallback(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 48, bottom: 48, left: 48, right: 48 },
      info: { Title: "Professional document", Author: "JobNester" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (b) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    text.split("\n").forEach((line, i) => {
      if (i === 0) doc.font("Helvetica-Bold").fontSize(20);
      else if (/^(SKILLS|EXPERIENCE|COVER LETTER|SUMMARY)$/i.test(line.trim()))
        doc.moveDown(0.45).font("Helvetica-Bold").fontSize(11);
      else doc.font("Helvetica").fontSize(10);
      doc.text(line || " ", { lineGap: 3.5 });
    });
    doc.end();
  });
}

export async function renderPdf(title: string, text: string): Promise<Buffer> {
  const html = documentHtml(title, text);
  return (await playwrightPdf(html)) || pdfkitFallback(text);
}
