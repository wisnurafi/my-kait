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

interface DiscordFetchOutcome {
  /** Last response received; null when every attempt failed at network level. */
  response: Response | null;
  /** True when the final failure was an exhausted 429. */
  rateLimited: boolean;
  /** Capped retry_after (seconds) from the last 429; 0 when none seen. */
  retryAfter: number;
  /** Network error message, set when response is null. */
  networkError?: string;
}

/**
 * Shared Discord request executor — one retry policy for send, edit and
 * delete:
 * - 429 → sleep Discord's retry_after (capped at MAX_RETRY_WAIT_S), retry
 * - 5xx → linear backoff, retry (a momentary Discord outage shouldn't
 *   permanently fail the request)
 * - network error/timeout → linear backoff, retry
 * - other 4xx → permanent, returned immediately without retry
 */
async function fetchDiscordWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3,
): Promise<DiscordFetchOutcome> {
  let retryAfter = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response;
    try {
      response = await fetchWithTimeout(url, init);
    } catch (err) {
      // Network error — retry if attempts remain
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return {
        response: null,
        rateLimited: false,
        retryAfter: 0,
        networkError: err instanceof Error ? err.message : "Error jaringan",
      };
    }

    if (response.status === 429) {
      const body = await response.json().catch(() => null);
      // Cap the backoff: never sleep longer than MAX_RETRY_WAIT_S
      // on a single wait, no matter what retry_after claims.
      retryAfter = Math.min(
        Math.ceil(body?.retry_after ?? 5),
        MAX_RETRY_WAIT_S,
      );
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      return { response, rateLimited: true, retryAfter };
    }

    if (response.status >= 500 && response.status <= 599) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
    }

    return { response, rateLimited: false, retryAfter };
  }

  // Unreachable: every iteration either continues (attempt < maxRetries)
  // or returns. Present only to satisfy the type checker.
  throw new Error("unreachable");
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
 * Retries via fetchDiscordWithRetry (429 with Discord's retry_after backoff,
 * 5xx and network errors with linear backoff; max 3 retries).
 * See PRD 3.4, 6.3.
 */
export async function sendWebhookMessage(
  url: string,
  payload: Record<string, unknown>,
  maxRetries = 3,
): Promise<SendResult> {
  const sendUrl = url.includes("?") ? `${url}&wait=true` : `${url}?wait=true`;
  const outcome = await fetchDiscordWithRetry(
    sendUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MyKait/1.0 (webhook-studio)",
      },
      body: JSON.stringify(payload),
      redirect: "error",
    },
    maxRetries,
  );

  if (!outcome.response) {
    return {
      success: false,
      httpStatus: 0,
      error: outcome.networkError ?? "Error jaringan",
    };
  }
  const response = outcome.response;

  if (response.status === 204 || response.status === 200) {
    const data = await response.json().catch(() => null);
    return {
      success: true,
      messageId: data?.id,
      httpStatus: response.status,
    };
  }

  if (outcome.rateLimited) {
    return {
      success: false,
      httpStatus: 429,
      rateLimited: true,
      retryAfter: outcome.retryAfter,
      error: `Rate limited oleh Discord. Coba lagi dalam ${outcome.retryAfter} detik.`,
    };
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

  if (response.status >= 500 && response.status <= 599) {
    return {
      success: false,
      httpStatus: response.status,
      error: `Discord error HTTP ${response.status}`,
    };
  }

  const body = await response.json().catch(() => null);
  return {
    success: false,
    httpStatus: response.status,
    error: body?.message ?? `HTTP ${response.status}`,
  };
}

/**
 * Edit a sent message (PATCH).
 * Retries via fetchDiscordWithRetry — same 429/5xx/network policy as send.
 * See PRD 3.5.
 */
export async function editWebhookMessage(
  url: string,
  messageId: string,
  payload: Record<string, unknown>,
  maxRetries = 3,
): Promise<SendResult> {
  const outcome = await fetchDiscordWithRetry(
    `${url}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MyKait/1.0 (webhook-studio)",
      },
      body: JSON.stringify(payload),
      redirect: "error",
    },
    maxRetries,
  );

  if (!outcome.response) {
    return {
      success: false,
      httpStatus: 0,
      error: outcome.networkError ?? "Error jaringan",
    };
  }
  const response = outcome.response;

  if (response.ok) {
    return { success: true, httpStatus: response.status, messageId };
  }

  if (outcome.rateLimited) {
    return {
      success: false,
      httpStatus: 429,
      rateLimited: true,
      retryAfter: outcome.retryAfter,
      error: `Rate limited oleh Discord. Coba lagi dalam ${outcome.retryAfter} detik.`,
    };
  }

  const body = await response.json().catch(() => null);
  return {
    success: false,
    httpStatus: response.status,
    error: body?.message ?? `HTTP ${response.status}`,
  };
}

/**
 * Delete a sent message (DELETE).
 * Retries via fetchDiscordWithRetry — same 429/5xx/network policy as send.
 * See PRD 3.5.
 */
export async function deleteWebhookMessage(
  url: string,
  messageId: string,
  maxRetries = 3,
): Promise<SendResult> {
  const outcome = await fetchDiscordWithRetry(
    `${url}/messages/${messageId}`,
    {
      method: "DELETE",
      headers: {
        "User-Agent": "MyKait/1.0 (webhook-studio)",
      },
      redirect: "error",
    },
    maxRetries,
  );

  if (!outcome.response) {
    return {
      success: false,
      httpStatus: 0,
      error: outcome.networkError ?? "Error jaringan",
    };
  }
  const response = outcome.response;

  if (response.ok || response.status === 204) {
    return { success: true, httpStatus: 204 };
  }

  if (outcome.rateLimited) {
    return {
      success: false,
      httpStatus: 429,
      rateLimited: true,
      retryAfter: outcome.retryAfter,
      error: `Rate limited oleh Discord. Coba lagi dalam ${outcome.retryAfter} detik.`,
    };
  }

  const body = await response.json().catch(() => null);
  return {
    success: false,
    httpStatus: response.status,
    error: body?.message ?? `HTTP ${response.status}`,
  };
}
