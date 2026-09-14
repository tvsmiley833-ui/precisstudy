// Canvas personal-access-token storage. Mirrors google-token.ts's shape and
// uses the same shared AES-GCM-at-rest encryption (see token-crypto.ts) --
// the domain+token pair is the only long-lived Canvas secret this app holds.

import { encryptRecord, decryptRecord } from "./token-crypto.js";

export interface CanvasTokenRecord {
  domain: string; // e.g. "school.instructure.com" -- no protocol, no path
  apiToken: string;
  connectedAt: string; // ISO 8601
}

export function canvasTokenKey(email: string): string {
  return "canvastok:" + email;
}

export async function putCanvasToken(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string },
  email: string,
  record: CanvasTokenRecord
): Promise<void> {
  const packed = await encryptRecord(env.SESSION_SECRET, record);
  await env.PROGRESS.put(canvasTokenKey(email), packed);
}

export async function getCanvasToken(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string },
  email: string
): Promise<CanvasTokenRecord | null> {
  const raw = await env.PROGRESS.get(canvasTokenKey(email));
  if (!raw) return null;
  try {
    return await decryptRecord<CanvasTokenRecord>(env.SESSION_SECRET, raw);
  } catch (e) {
    return null;
  }
}

export async function deleteCanvasToken(env: { PROGRESS: KVNamespace }, email: string): Promise<void> {
  await env.PROGRESS.delete(canvasTokenKey(email));
}
