/**
 * AES-256-GCM encryption for webhook URLs.
 * Key rotation supported via key_version on each record.
 *
 * Key must be 64 hex chars (32 bytes). Generate with:
 *   openssl rand -hex 32
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "./env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

function getKey(version: string): Buffer {
  // For now, single key. Future: map version -> key for rotation.
  const keyHex = env.WEBHOOK_ENCRYPTION_KEY;
  if (keyHex.length !== 64) {
    throw new Error(
      `WEBHOOK_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Got ${keyHex.length} chars.`,
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a webhook URL.
 * Returns a combined string: iv:authTag:ciphertext (all hex).
 * The key_version is stored separately on the record.
 */
export function encryptWebhookUrl(plaintext: string): {
  encrypted: string;
  keyVersion: string;
} {
  const keyVersion = env.WEBHOOK_ENCRYPTION_KEY_VERSION;
  const key = getKey(keyVersion);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: [
      iv.toString("hex"),
      authTag.toString("hex"),
      encrypted.toString("hex"),
    ].join(":"),
    keyVersion,
  };
}

/**
 * Decrypt a webhook URL.
 * Expects the combined string from encryptWebhookUrl.
 */
export function decryptWebhookUrl(
  encrypted: string,
  _keyVersion: string,
): string {
  const key = getKey(_keyVersion);

  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
