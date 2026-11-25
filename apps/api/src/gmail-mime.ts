/** Build RFC 2822 MIME messages for Gmail API users.messages.send. */

function encodeSubject(subject: string) {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function boundary() {
  return `jn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type MailAttachment = {
  filename: string;
  mimeType: string;
  content: Buffer;
};

export function buildApplicationMime(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments: MailAttachment[];
}) {
  const mixed = boundary();
  const lines = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    "",
    `--${mixed}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "",
    input.body.replace(/\r?\n/g, "\r\n"),
  ];
  for (const file of input.attachments) {
    const safeName = file.filename.replace(/["\r\n]/g, "_").slice(0, 180);
    lines.push(
      `--${mixed}`,
      `Content-Type: ${file.mimeType}; name="${safeName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${safeName}"`,
      "",
      file.content
        .toString("base64")
        .replace(/.{1,76}/g, (chunk) => chunk)
        .match(/.{1,76}/g)
        ?.join("\r\n") || "",
    );
  }
  lines.push(`--${mixed}--`, "");
  return Buffer.from(lines.join("\r\n"), "utf8");
}

export function encodeGmailRaw(mime: Buffer) {
  return mime
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
