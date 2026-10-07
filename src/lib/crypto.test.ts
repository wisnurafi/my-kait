import { describe, it, expect } from "vitest";
import { encryptWebhookUrl, decryptWebhookUrl } from "./crypto";

const URL = "https://discord.com/api/webhooks/123/abc-def";

describe("encryptWebhookUrl / decryptWebhookUrl", () => {
  it("round-trips a webhook URL", () => {
    const { encrypted, keyVersion } = encryptWebhookUrl(URL);
    expect(decryptWebhookUrl(encrypted, keyVersion)).toBe(URL);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const a = encryptWebhookUrl(URL).encrypted;
    const b = encryptWebhookUrl(URL).encrypted;
    expect(a).not.toBe(b);
  });

  it("returns the configured key version", () => {
    const { keyVersion } = encryptWebhookUrl(URL);
    expect(keyVersion).toBe("1");
  });

  it("throws on malformed payload", () => {
    expect(() => decryptWebhookUrl("not-valid", "1")).toThrow();
    expect(() => decryptWebhookUrl("a:b", "1")).toThrow();
  });

  it("throws when ciphertext is tampered with", () => {
    const { encrypted, keyVersion } = encryptWebhookUrl(URL);
    const parts = encrypted.split(":");
    // Flip a hex char in the ciphertext part
    parts[2] =
      parts[2].slice(0, -1) + (parts[2].endsWith("0") ? "1" : "0");
    expect(() => decryptWebhookUrl(parts.join(":"), keyVersion)).toThrow();
  });
});
