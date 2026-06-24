import "server-only";
import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for API keys at rest.
 *
 * ENCRYPTION_KEY is a base64-encoded 32-byte key (see .env.local).
 * Output format: "<iv>:<authTag>:<ciphertext>", all base64.
 *
 * SERVER ONLY — `server-only` import throws if this is ever bundled for the
 * browser.
 */

function getKey(): Buffer {
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) throw new Error("Missing ENCRYPTION_KEY env var");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to 32 bytes (base64)");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decrypt(blob: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = blob.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed ciphertext");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Show only the last 4 chars of a secret, e.g. "••••••••3218". */
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return "••••••••" + plaintext.slice(-4);
}
