/** Inspect ZIP central-directory metadata before allowing DOCX decompression. */
export function inspectDocx(buffer: Buffer) {
  if (buffer.length < 22 || buffer.readUInt16LE(0) !== 0x4b50)
    throw Error("Invalid DOCX ZIP");
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw Error("Invalid ZIP directory");
  const entries = buffer.readUInt16LE(end + 10),
    start = buffer.readUInt32LE(end + 16);
  if (entries > 500 || start >= buffer.length)
    throw Error("Document archive is too large");
  let at = start,
    total = 0,
    hasDocument = false;
  for (let i = 0; i < entries; i++) {
    if (at + 46 > buffer.length || buffer.readUInt32LE(at) !== 0x02014b50)
      throw Error("Malformed document archive");
    const size = buffer.readUInt32LE(at + 24),
      nameLength = buffer.readUInt16LE(at + 28),
      extraLength = buffer.readUInt16LE(at + 30),
      commentLength = buffer.readUInt16LE(at + 32);
    total += size;
    if (total > 20 * 1024 * 1024) throw Error("Expanded document is too large");
    const name = buffer
      .subarray(at + 46, at + 46 + nameLength)
      .toString("utf8");
    if (name === "word/document.xml") hasDocument = true;
    at += 46 + nameLength + extraLength + commentLength;
  }
  if (!hasDocument) throw Error("Not a Word document");
}
