import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildApplicationMime,
  encodeGmailRaw,
} from "../apps/api/src/documents/gmail-mime.ts";

describe("gmail mime", () => {
  it("builds multipart message with attachments and gmail-safe raw encoding", () => {
    const mime = buildApplicationMime({
      from: "owner@example.com",
      to: "hiring@acme.com",
      subject: "Application: Engineer",
      body: "Hello hiring team,\n\nPlease find my documents attached.",
      attachments: [
        {
          filename: "resume.pdf",
          mimeType: "application/pdf",
          content: Buffer.from("%PDF-1.4 resume"),
        },
        {
          filename: "cover-letter.pdf",
          mimeType: "application/pdf",
          content: Buffer.from("%PDF-1.4 letter"),
        },
      ],
    });
    const text = mime.toString("utf8");
    assert.match(text, /To: hiring@acme.com/);
    assert.match(text, /Subject: Application: Engineer/);
    assert.match(text, /filename="resume.pdf"/);
    assert.match(text, /filename="cover-letter.pdf"/);
    assert.match(text, /Content-Type: multipart\/mixed/);
    const raw = encodeGmailRaw(mime);
    assert.equal(raw.includes("+"), false);
    assert.equal(raw.includes("/"), false);
    assert.equal(raw.endsWith("="), false);
  });
});
