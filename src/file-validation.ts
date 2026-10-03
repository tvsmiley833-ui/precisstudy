export const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

// The client-reported Content-Type is just a form field the browser sends
// alongside the file -- nothing stops a malicious upload from claiming
// image/png while actually containing HTML/script content. Checking the
// real file signature closes that gap. text/plain has no reliable magic
// bytes, so it's allowed through unchecked.
const MAGIC_BYTES: Record<string, Array<(buf: ArrayBuffer) => boolean>> = {
  "application/pdf": [buf => bytesStartWith(buf, [0x25, 0x50, 0x44, 0x46])], // %PDF
  "image/png": [buf => bytesStartWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  "image/jpeg": [buf => bytesStartWith(buf, [0xff, 0xd8, 0xff])],
  "image/webp": [buf => bytesStartWith(buf, [0x52, 0x49, 0x46, 0x46]) && bytesStartWithAt(buf, 8, [0x57, 0x45, 0x42, 0x50])], // RIFF....WEBP
  "application/msword": [buf => bytesStartWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], // OLE compound file
  // zip signature AND a word/document.xml entry name, so an arbitrary zip is not accepted as a .docx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [buf => bytesStartWith(buf, [0x50, 0x4b, 0x03, 0x04]) && containsAscii(buf, "word/document.xml")]
};

function containsAscii(buf: ArrayBuffer, needle: string): boolean {
  const hay = new Uint8Array(buf);
  const n = new TextEncoder().encode(needle);
  outer: for (let i = 0; i <= hay.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"
};

/** Download headers for a stored upload: a fixed, allowlisted type and a filename whose extension matches that type. */
export function safeDownloadInfo(rawName: unknown, rawType: unknown): { type: string; disposition: string } {
  const type = typeof rawType === "string" && ALLOWED_UPLOAD_TYPES.has(rawType) ? rawType : "application/octet-stream";
  const ext = EXT_BY_TYPE[type] ?? "bin";
  let base = String(rawName || "attachment").replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, "_").replace(/^\.+/, "").trim();
  base = base.replace(/\.[A-Za-z0-9]{1,8}$/, "").slice(0, 120) || "attachment";
  const name = `${base}.${ext}`;
  const ascii = name.replace(/[^\x20-\x7e]/g, "_");
  return { type, disposition: `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}` };
}

function bytesStartWith(buf: ArrayBuffer, sig: number[]): boolean {
  const view = new Uint8Array(buf, 0, Math.min(sig.length, buf.byteLength));
  return sig.every((b, i) => view[i] === b);
}

function bytesStartWithAt(buf: ArrayBuffer, offset: number, sig: number[]): boolean {
  if (buf.byteLength < offset + sig.length) return false;
  const view = new Uint8Array(buf, offset, sig.length);
  return sig.every((b, i) => view[i] === b);
}

export function matchesDeclaredType(buf: ArrayBuffer, type: string): boolean {
  const checks = MAGIC_BYTES[type];
  if (!checks) return true; // text/plain or anything without a defined signature
  return checks.some(check => check(buf));
}
