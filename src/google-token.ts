// Refresh-token storage for the Google Classroom/Calendar connection.
// The refresh token is the only long-lived secret we hold for a user, so it is
// AES-GCM encrypted at rest in KV via the shared token-crypto helpers. The key
// is derived from SESSION_SECRET via HKDF-SHA-256 so rotating SESSION_SECRET
// invalidates every stored token (they simply fail to decrypt, and getGoogleToken
// returns null -> "not connected"). Access tokens are never stored -- see
// src/google-sync.ts.

import { encryptRecord, decryptRecord } from "./token-crypto.js";

export interface GoogleTokenRecord {
  refreshToken: string;
  googleEmail: string;
  scopes: string[];
  connectedAt: string; // ISO 8601
}

export function googleTokenKey(email: string): string {
  return "gtok:" + email;
}

export async function encryptTokenRecord(secret: string, record: GoogleTokenRecord): Promise<string> {
  return encryptRecord(secret, record);
}

export async function decryptTokenRecord(secret: string, packedB64: string): Promise<GoogleTokenRecord> {
  return decryptRecord<GoogleTokenRecord>(secret, packedB64);
}

export async function putGoogleToken(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string },
  email: string,
  record: GoogleTokenRecord
): Promise<void> {
  const packed = await encryptTokenRecord(env.SESSION_SECRET, record);
  await env.PROGRESS.put(googleTokenKey(email), packed);
}

export async function getGoogleToken(
  env: { PROGRESS: KVNamespace; SESSION_SECRET: string },
  email: string
): Promise<GoogleTokenRecord | null> {
  const raw = await env.PROGRESS.get(googleTokenKey(email));
  if (!raw) return null;
  try {
    return await decryptTokenRecord(env.SESSION_SECRET, raw);
  } catch (e) {
    // Wrong/rotated secret, or a corrupt blob -> treat as "not connected"
    // rather than 500 the endpoint.
    return null;
  }
}

export async function deleteGoogleToken(env: { PROGRESS: KVNamespace }, email: string): Promise<void> {
  await env.PROGRESS.delete(googleTokenKey(email));
}
