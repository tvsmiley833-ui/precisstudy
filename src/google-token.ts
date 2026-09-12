// Refresh-token storage for the Google Classroom/Calendar connection.
// The refresh token is the only long-lived secret we hold for a user, so it is
// AES-GCM encrypted at rest in KV. The key is derived from SESSION_SECRET via
// HKDF-SHA-256 so rotating SESSION_SECRET invalidates every stored token (they
// simply fail to decrypt, and getGoogleToken returns null -> "not connected").
// Access tokens are never stored -- see src/google-sync.ts.

export interface GoogleTokenRecord {
  refreshToken: string;
  googleEmail: string;
  scopes: string[];
  connectedAt: string; // ISO 8601
}

const ENC_SALT = "precisstudy-google-token";
const ENC_INFO = "v1";
const IV_BYTES = 12;

export function googleTokenKey(email: string): string {
  return "gtok:" + email;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(ENC_SALT),
      info: new TextEncoder().encode(ENC_INFO)
    },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64); // throws on malformed input -> callers treat as "no token"
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptTokenRecord(secret: string, record: GoogleTokenRecord): Promise<string> {
  if (!secret) throw new Error("encryptTokenRecord: missing SESSION_SECRET");
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const pt = new TextEncoder().encode(JSON.stringify(record));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return bytesToBase64(packed);
}

export async function decryptTokenRecord(secret: string, packedB64: string): Promise<GoogleTokenRecord> {
  if (!secret) throw new Error("decryptTokenRecord: missing SESSION_SECRET");
  const packed = base64ToBytes(packedB64);
  if (packed.length <= IV_BYTES) throw new Error("decryptTokenRecord: ciphertext too short");
  const iv = packed.slice(0, IV_BYTES);
  const ct = packed.slice(IV_BYTES);
  const key = await deriveKey(secret);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt)) as GoogleTokenRecord;
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
