// Shared AES-GCM-at-rest encryption for third-party API tokens (Google
// refresh tokens, Canvas personal access tokens, ...). The key is derived
// from SESSION_SECRET via HKDF-SHA-256 so rotating SESSION_SECRET
// invalidates every stored token (they simply fail to decrypt, and callers
// treat that as "not connected"). Generic over the record shape -- these
// functions have no provider-specific logic, they just JSON-serialize
// whatever record they're given.
//
// ENC_SALT is unchanged from when this lived only in google-token.ts --
// changing it would silently break decryption of every already-stored
// Google refresh token in production.

const ENC_SALT = "precisstudy-google-token";
const ENC_INFO = "v1";
const IV_BYTES = 12;

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

export async function encryptRecord<T>(secret: string, record: T): Promise<string> {
  if (!secret) throw new Error("encryptRecord: missing SESSION_SECRET");
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const pt = new TextEncoder().encode(JSON.stringify(record));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return bytesToBase64(packed);
}

export async function decryptRecord<T>(secret: string, packedB64: string): Promise<T> {
  if (!secret) throw new Error("decryptRecord: missing SESSION_SECRET");
  const packed = base64ToBytes(packedB64);
  if (packed.length <= IV_BYTES) throw new Error("decryptRecord: ciphertext too short");
  const iv = packed.slice(0, IV_BYTES);
  const ct = packed.slice(IV_BYTES);
  const key = await deriveKey(secret);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
