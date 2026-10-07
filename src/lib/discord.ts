/**
 * Discord webhook URL validation & interaction.
 * See PRD sections 3.2, 3.2.1, 3.4, 5.4.
 *
 * Anti-SSRF: only discord.com / discordapp.com hosts allowed.
 */

import { env } from "./env";

const ALLOWED_HOSTS = [
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "ptb.discordapp.com",
  "canary.discord.com",
  "canary.discordapp.com",
];

const WEBHOOK_PATH_REGEX = /^\/api\/webhooks\/\d+\/[\w-]+$/;

/**
 * Discord usually answers in well under 2s. Without a timeout a hung
 * connection would block a server action until the platform kills it,
 * wasting a slot that could serve other users.
 */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Upper bound for a single 429 backoff wait. Discord's `retry_after` is
 * normally a few seconds, but we never trust the value blindly — an
 * uncapped sleep could stall a server action for minutes.
 */
const MAX_RETRY_WAIT_S = 30;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validate that a URL is a legitimate Discord webhook URL.
 * Throws on invalid — does not make a network request.
 */
export function validateWebhookUrl(url: string): {
  valid: boolean;
  webhookId?: string;
  token?: string;
} {
  try {
    const parsed = new URL(url);

    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return { valid: false };
    }

    if (!WEBHOOK_PATH_REGEX.test(parsed.pathname)) {
      return { valid: false };
    }

    const parts = parsed.pathname.split("/");
    // /api/webhooks/{id}/{token}
    const webhookId = parts[3];
    const token = parts[4];

    return { valid: true, webhookId, token };
  } catch {
    return { valid: false };
  }
}

export type PingResult = {
  status: "active" | "invalid" | "rate_limited" | "error";
  httpStatus: number | null;
  latencyMs: number | null;
  error?: string;
  webhookName?: string;
  channelId?: string;
  channelName?: string;
  guildId?: string;
  guildName?: string;
};

/**
 * Ping a webhook — silent GET request (no message appears in channel).
 * See PRD 3.2.1.
 */
export async function pingWebhook(url: string): Promise<PingResult> {
  const start = Date.now();
  const validation = validateWebhookUrl(url);
  if (!validation.valid) {
    return {
      status: "invalid",
      httpStatus: null,
      latencyMs: null,
      error: "URL bukan webhook Discord yang valid",
    };
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        "User-Agent": "MyKait/1.0 (webhook-studio)",
      },
      // No redirects to external hosts (anti-SSRF)
      redirect: "error",
    });

    const latencyMs = Date.now() - start;

    if (response.status === 200) {
      const data = await response.json();
      return {
        status: "active",
        httpStatus: 200,
        latencyMs,
        webhookName: data.name,
        channelId: data.channel_id,
        channelName: data.channel_name,
        guildId: data.guild_id,
        guildName: data.guild?.name,
      };
    }

    if (response.status === 404) {
      return {
        status: "invalid",
        httpStatus: 404,
        latencyMs,
        error: "Webhook sudah dihapus atau URL salah",
      };
    }

    if (response.status === 401) {
      return {
        status: "invalid",
        httpStatus: 401,
        latencyMs,
        error: "Token tidak valid",
      };
    }

    if (response.status === 429) {
      const body = await response.json().catch(() => null);
      const retryAfter = body?.retry_after ?? 5;
      return {
        status: "rate_limited",
        httpStatus: 429,
        latencyMs,
        error: `Terkena rate limit, coba lagi dalam ${Math.ceil(retryAfter)} detik`,
      };
    }

    return {
      status: "error",
      httpStatus: response.status,
      latencyMs,
      error: `HTTP ${response.status}`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      status: "error",
      httpStatus: null,
      latencyMs,
      error: err instanceof Error ? err.message : "Error jaringan",
    };
  }
}

export type SendResult = {
  success: boolean;
  messageId?: string;
  httpStatus: number;
  error?: string;
  rateLimited?: boolean;
  retryAfter?: number;
};

/**
 * Send a message via webhook.
 * Uses ?wait=true to get the message ID back.
 * Automatically retries on 429 with Discord's retry_after backoff (max 3 retries),
 * on 5xx with linear backoff (max 3 retries), and on network errors/timeouts.
 * See PRD 3.4, 6.3.
 */
export async function sendWebhookMessage(
  url: string,
  payload: Record<string, unknown>,
  maxRetries = 3,
): Promise<SendResult> {
  const start = Date.now();
  let lastResult: SendResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const sendUrl = url.includes("?") ? `${url}&wait=true` : `${url}?wait=true`;

      const response = await fetchWithTimeout(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "MyKait/1.0 (webhook-studio)",
        },
        body: JSON.stringify(payload),
        redirect: "error",
      });

      if (response.status === 204 || response.status === 200) {
        const data = await response.json().catch(() => null);
        return {
          success: true,
          messageId: data?.id,
          httpStatus: response.status,
        };
      }

      if (response.status === 429) {
        const body = await response.json().catch(() => null);
        // Cap the backoff: never sleep longer than MAX_RETRY_WAIT_S
        // on a single wait, no matter what retry_after claims.
        const retryAfter = Math.min(
          Math.ceil(body?.retry_after ?? 5),
          MAX_RETRY_WAIT_S,
        );
        lastResult = {
          success: false,
          httpStatus: 429,
          rateLimited: true,
          retryAfter,
          error: `Rate limited oleh Discord. Coba lagi dalam ${retryAfter} detik.`,
        };
        // Auto-retry with backoff if attempts remain
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }
        return lastResult;
      }

      // Transient Discord errors (5xx) are retried with backoff, like 429s —
      // a momentary Discord outage shouldn't permanently fail a message.
      // 4xx (other than 429) are permanent and fail immediately.
      if (response.status >= 500 && response.status <= 599) {
        lastResult = {
          success: false,
          httpStatus: response.status,
          error: `Discord error HTTP ${response.status}`,
        };
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        return lastResult;
      }

    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      return {
        success: false,
        httpStatus: 400,
        error: body?.message
          ? `Discord: ${body.message}`
          : "Payload tidak valid (periksa field embed)",
      };
    }

    const latencyMs = Date.now() - start;
    void latencyMs;

    const body = await response.json().catch(() => null);
    return {
      success: false,
      httpStatus: response.status,
      error: body?.message ?? `HTTP ${response.status}`,
    };
    } catch (err) {
      // Network error — retry if attempts remain
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return {
        success: false,
        httpStatus: 0,
        error: err instanceof Error ? err.message : "Error jaringan",
      };
    }
  }

  // Should not reach here, but return last 429 result if we do
  return (
    lastResult ?? {
      success: false,
      httpStatus: 429,
      rateLimited: true,
      error: "Rate limited oleh Discord.",
    }
  );
}

/**
 * Edit a sent message (PATCH).
 * See PRD 3.5.
 */
export async function editWebhookMessage(
  url: string,
  messageId: string,
  payload: Record<string, unknown>,
): Promise<SendResult> {
  try {
    const editUrl = `${url}/messages/${messageId}`;
    const response = await fetchWithTimeout(editUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MyKait/1.0 (webhook-studio)",
      },
      body: JSON.stringify(payload),
      redirect: "error",
    });

    if (response.ok) {
      return { success: true, httpStatus: response.status, messageId };
    }

    const body = await response.json().catch(() => null);
    return {
      success: false,
      httpStatus: response.status,
      error: body?.message ?? `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      success: false,
      httpStatus: 0,
      error: err instanceof Error ? err.message : "Error jaringan",
    };
  }
}

/**
 * Delete a sent message (DELETE).
 * See PRD 3.5.
 */
export async function deleteWebhookMessage(
  url: string,
  messageId: string,
): Promise<SendResult> {
  try {
    const deleteUrl = `${url}/messages/${messageId}`;
    const response = await fetchWithTimeout(deleteUrl, {
      method: "DELETE",
      headers: {
        "User-Agent": "MyKait/1.0 (webhook-studio)",
      },
      redirect: "error",
    });

    if (response.ok || response.status === 204) {
      return { success: true, httpStatus: 204 };
    }

    const body = await response.json().catch(() => null);
    return {
      success: false,
      httpStatus: response.status,
      error: body?.message ?? `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      success: false,
      httpStatus: 0,
      error: err instanceof Error ? err.message : "Error jaringan",
    };
  }
}
