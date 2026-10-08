import { describe, it, expect, vi, afterEach } from "vitest";
import {
  sendWebhookMessage,
  editWebhookMessage,
  deleteWebhookMessage,
} from "./discord";

function jsonResponse(status: number, body: unknown = null): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockFetchSequence(responses: Array<Response | Error>) {
  const calls: string[] = [];
  const mock = vi.fn(async (url: string) => {
    calls.push(url);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next as Response;
  });
  vi.stubGlobal("fetch", mock);
  return { mock, calls };
}

describe("sendWebhookMessage retry policy", () => {
  it("retries once on 429 then succeeds", async () => {
    const { mock } = mockFetchSequence([
      jsonResponse(429, { retry_after: 0 }),
      jsonResponse(200, { id: "msg-1" }),
    ]);
    const res = await sendWebhookMessage("https://discord.com/api/webhooks/1/abc", { content: "hi" });
    expect(res.success).toBe(true);
    expect(res.messageId).toBe("msg-1");
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("returns rateLimited when 429s are exhausted", async () => {
    mockFetchSequence([jsonResponse(429, { retry_after: 0 })]);
    const res = await sendWebhookMessage("https://discord.com/api/webhooks/1/abc", {}, 0);
    expect(res.success).toBe(false);
    expect(res.rateLimited).toBe(true);
    expect(res.httpStatus).toBe(429);
  });

  it("caps retry_after at 30s", async () => {
    mockFetchSequence([jsonResponse(429, { retry_after: 999 })]);
    const res = await sendWebhookMessage("https://discord.com/api/webhooks/1/abc", {}, 0);
    expect(res.retryAfter).toBe(30);
  });

  it("retries on 5xx then succeeds", async () => {
    const { mock } = mockFetchSequence([
      jsonResponse(502),
      jsonResponse(204),
    ]);
    const res = await sendWebhookMessage("https://discord.com/api/webhooks/1/abc", {});
    expect(res.success).toBe(true);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400", async () => {
    const { mock } = mockFetchSequence([
      jsonResponse(400, { message: "Bad request" }),
    ]);
    const res = await sendWebhookMessage("https://discord.com/api/webhooks/1/abc", {});
    expect(res.success).toBe(false);
    expect(res.httpStatus).toBe(400);
    expect(res.error).toContain("Bad request");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("retries on network error then succeeds", async () => {
    const { mock } = mockFetchSequence([
      new Error("boom"),
      jsonResponse(200, { id: "msg-2" }),
    ]);
    const res = await sendWebhookMessage("https://discord.com/api/webhooks/1/abc", {});
    expect(res.success).toBe(true);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("returns httpStatus 0 when network fails on all attempts", async () => {
    mockFetchSequence([new Error("down")]);
    const res = await sendWebhookMessage("https://discord.com/api/webhooks/1/abc", {}, 0);
    expect(res.success).toBe(false);
    expect(res.httpStatus).toBe(0);
  });
});

describe("edit/delete share the same retry policy", () => {
  it("edit retries on 429 then succeeds", async () => {
    const { mock, calls } = mockFetchSequence([
      jsonResponse(429, { retry_after: 0 }),
      jsonResponse(200, {}),
    ]);
    const res = await editWebhookMessage("https://discord.com/api/webhooks/1/abc", "m1", { content: "x" });
    expect(res.success).toBe(true);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(calls[0]).toContain("/messages/m1");
  });

  it("edit returns rateLimited when 429s are exhausted", async () => {
    mockFetchSequence([jsonResponse(429, { retry_after: 0 })]);
    const res = await editWebhookMessage("https://discord.com/api/webhooks/1/abc", "m1", {}, 0);
    expect(res.rateLimited).toBe(true);
    expect(res.httpStatus).toBe(429);
  });

  it("delete retries on 429 then succeeds", async () => {
    const { mock } = mockFetchSequence([
      jsonResponse(429, { retry_after: 0 }),
      jsonResponse(204),
    ]);
    const res = await deleteWebhookMessage("https://discord.com/api/webhooks/1/abc", "m1");
    expect(res.success).toBe(true);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("delete retries on 5xx then succeeds", async () => {
    const { mock } = mockFetchSequence([
      jsonResponse(503),
      jsonResponse(204),
    ]);
    const res = await deleteWebhookMessage("https://discord.com/api/webhooks/1/abc", "m1");
    expect(res.success).toBe(true);
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
