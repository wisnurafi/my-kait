/**
 * Public platform stats — powers the landing page stats strip.
 * Aggregates only (no PII, no per-user data). Safe to expose publicly.
 * Shared by the /api/stats route and the landing page (ISR, 5 min).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { messageLogs, webhooks } from "@/lib/schema";
import { logger } from "@/lib/logger";

export interface PublicStats {
  totalMessages: number;
  totalWebhooks: number;
  deliveryRate: number; // 0-100, one decimal
  medianLatencyMs: number | null;
  cachedAt: string;
}

const FALLBACK: PublicStats = {
  totalMessages: 0,
  totalWebhooks: 0,
  deliveryRate: 100,
  medianLatencyMs: null,
  cachedAt: new Date().toISOString(),
};

export async function getPublicStats(): Promise<PublicStats> {
  try {
    const [row] = await db
      .select({
        // Delivery attempts only — 'deleted' rows are an audit trail,
        // not delivery outcomes.
        total: sql<number>`count(*) filter (where ${messageLogs.status} in ('sent', 'edited', 'failed', 'rate_limited'))::int`,
        sent: sql<number>`count(*) filter (where ${messageLogs.status} in ('sent', 'edited'))::int`,
        medianLatencyMs: sql<number | null>`percentile_cont(0.5) within group (order by ${messageLogs.latencyMs}) filter (where ${messageLogs.latencyMs} is not null)`,
        totalWebhooks: sql<number>`(select count(*) from ${webhooks})::int`,
      })
      .from(messageLogs);

    const total = row?.total ?? 0;
    const sent = row?.sent ?? 0;

    return {
      totalMessages: total,
      totalWebhooks: row?.totalWebhooks ?? 0,
      deliveryRate:
        total > 0 ? Math.round((sent / total) * 1000) / 10 : 100,
      medianLatencyMs:
        row?.medianLatencyMs != null ? Math.round(row.medianLatencyMs) : null,
      cachedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error("public-stats", "failed to load stats, serving fallback", err);
    // Never break the landing page — serve a graceful fallback
    return FALLBACK;
  }
}
