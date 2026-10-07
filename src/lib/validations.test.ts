import { describe, it, expect } from "vitest";
import {
  sendRequestSchema,
  templateSchema,
  messageModeSchema,
  httpUrlSchema,
  embedsSchema,
} from "./validations";

// Schemas take a translator; tests use an identity stub.
const t = (key: string) => key;

const validPayload = { content: "hello" };

describe("sendRequestSchema", () => {
  it("accepts a minimal valid request", () => {
    const res = sendRequestSchema(t).safeParse({
      webhookId: "wh_123",
      payload: validPayload,
      mode: "normal",
    });
    expect(res.success).toBe(true);
  });

  it("rejects an invalid mode", () => {
    const res = sendRequestSchema(t).safeParse({
      payload: validPayload,
      mode: "smoke-signal",
    });
    expect(res.success).toBe(false);
  });

  it("rejects content over 2000 chars", () => {
    const res = sendRequestSchema(t).safeParse({
      payload: { content: "x".repeat(2001) },
      mode: "normal",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a malformed manual URL", () => {
    const res = sendRequestSchema(t).safeParse({
      manualUrl: "not-a-url",
      payload: validPayload,
      mode: "normal",
    });
    expect(res.success).toBe(false);
  });

  it("defaults savePayload to true", () => {
    const res = sendRequestSchema(t).safeParse({
      payload: validPayload,
      mode: "embed",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.savePayload).toBe(true);
  });
});

describe("messageModeSchema", () => {
  it("accepts normal, embed, both", () => {
    for (const mode of ["normal", "embed", "both"]) {
      expect(messageModeSchema.safeParse(mode).success).toBe(true);
    }
  });
});

describe("templateSchema", () => {
  it("rejects an empty name and an over-long name", () => {
    expect(
      templateSchema(t).safeParse({ name: "", payload: validPayload }).success,
    ).toBe(false);
    expect(
      templateSchema(t).safeParse({ name: "x".repeat(101), payload: validPayload })
        .success,
    ).toBe(false);
  });

  it("rejects more than 10 tags", () => {
    expect(
      templateSchema(t).safeParse({
        name: "ok",
        payload: validPayload,
        tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
      }).success,
    ).toBe(false);
  });
});

describe("httpUrlSchema", () => {
  const schema = httpUrlSchema(t);

  it("accepts http and https URLs", () => {
    expect(schema.safeParse("https://example.com/img.png").success).toBe(true);
    expect(schema.safeParse("http://example.com/x").success).toBe(true);
  });

  // SECURITY: z.string().url() alone accepts these (URL parser), which would
  // become stored XSS when rendered as <a href> on the public share page.
  it("rejects javascript: URLs", () => {
    expect(schema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(schema.safeParse("JaVaScRiPt:alert(1)").success).toBe(false);
  });

  it("rejects data: URLs", () => {
    expect(schema.safeParse("data:text/html,<h1>x</h1>").success).toBe(false);
  });

  it("rejects non-URLs", () => {
    expect(schema.safeParse("not a url").success).toBe(false);
  });

  it("rejects javascript: URLs inside embeds", () => {
    const res = embedsSchema(t).safeParse([
      { title: "x", url: "javascript:alert(1)" },
    ]);
    expect(res.success).toBe(false);
  });
});
