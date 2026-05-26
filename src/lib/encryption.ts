import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// AES-256-GCM with a 12-byte nonce. We store iv + authTag + ciphertext
// separately so the table makes the layout obvious to any future reader.

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is required");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to 32 bytes (base64 of 32 random bytes)");
  }
  return key;
}

export type EncryptedBlob = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export function encrypt(plaintext: string): EncryptedBlob {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decrypt(blob: EncryptedBlob): string {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
