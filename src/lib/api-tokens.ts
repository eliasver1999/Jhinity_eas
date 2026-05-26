import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "eas_";

export function generatePlaintextToken(): string {
  // 32 random bytes → base64url. ~256 bits entropy.
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function isLikelyApiToken(s: string): boolean {
  return typeof s === "string" && s.startsWith(TOKEN_PREFIX) && s.length >= 40;
}
