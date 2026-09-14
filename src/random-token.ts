// Base64url, not hex -- same entropy in a shorter, URL-safe string. 18 random
// bytes (144 bits) is comfortably unguessable for an id that's only ever
// meant to be looked up by an owning session, not brute-forced.
export function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
