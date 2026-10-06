"use server";

/**
 * Dashboard statistics server actions.
 * Phase 4: statistics dashboard backed by message_logs.
 */

import { db } from "@/lib/db";
import { messageLogs } from "@/lib/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export type DailyStat = { date: string; total: number; sent: number; failed: number; deleted: number };
export type WebhookStat = {
  webhookId: string | null;
  name: string;
  total: number;
  sent: number;
  failed: number;
  deleted: number;
};
export type StatusStat = { status: string; count: number };

export async function getDashboardStats(): Promise<{
  daily: DailyStat[];
  webhooks: WebhookStat[];
  byStatus: StatusStat[];
  totals: { total: number; sent: number; failed: number; successRate: number };
}> {
  const user = await requireAuth();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Messages per day (last 30 days)
  const dailyRows = await db
    .select({
      date: sql<string>`to_char(${messageLogs.createdAt}, 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${messageLogs.status} in ('sent','edited'))::int`,
      failed: sql<number>`count(*) filter (where ${messageLogs.status} in ('failed','rate_limited'))::int`,
      deleted: sql<number>`count(*) filter (where ${messageLogs.status} = 'deleted')::int`,
    })
    .from(messageLogs)
    .where(
      and(
        eq(messageLogs.userId, user.id),
        gte(messageLogs.createdAt, since),
      ),
    )
    .groupBy(sql`to_char(${messageLogs.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${messageLogs.createdAt}, 'YYYY-MM-DD')`);

  // Fill missing days with zeros
  const byDate = new Map(dailyRows.map((r) => [r.date, r]));
  const daily: DailyStat[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const row = byDate.get(key);
    daily.push({
      date: key,
      total: row?.total ?? 0,
      sent: row?.sent ?? 0,
      failed: row?.failed ?? 0,
      deleted: row?.deleted ?? 0,
    });
  }

  // Most active webhooks (last 30 days)
  const webhookRows = await db
    .select({
      webhookId: messageLogs.webhookId,
      name: sql<string>`max(${messageLogs.webhookNameSnapshot})`,
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${messageLogs.status} in ('sent','edited'))::int`,
      failed: sql<number>`count(*) filter (where ${messageLogs.status} in ('failed','rate_limited'))::int`,
      deleted: sql<number>`count(*) filter (where ${messageLogs.status} = 'deleted')::int`,
    })
    .from(messageLogs)
    .where(
      and(
        eq(messageLogs.userId, user.id),
        gte(messageLogs.createdAt, since),
      ),
    )
    .groupBy(messageLogs.webhookId)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  const webhooks: WebhookStat[] = webhookRows.map((r) => ({
    webhookId: r.webhookId,
    name: r.name ?? "—",
    total: r.total,
    sent: r.sent,
    failed: r.failed,
    deleted: r.deleted,
  }));

  // Status breakdown (last 30 days)
  const statusRows = await db
    .select({
      status: messageLogs.status,
      count: sql<number>`count(*)::int`,
    })
    .from(messageLogs)
    .where(
      and(
        eq(messageLogs.userId, user.id),
        gte(messageLogs.createdAt, since),
      ),
    )
    .groupBy(messageLogs.status);

  const byStatus: StatusStat[] = statusRows.map((r) => ({
    status: r.status,
    count: r.count,
  }));

  // Delivery outcomes only: 'deleted' is a lifecycle event (audit trail),
  // not a delivery failure — it must not count as failed nor drag down
  // the success rate.
  const sent = byStatus
    .filter((s) => s.status === "sent" || s.status === "edited")
    .reduce((a, b) => a + b.count, 0);
  const failed = byStatus
    .filter((s) => s.status === "failed" || s.status === "rate_limited")
    .reduce((a, b) => a + b.count, 0);
  const total = sent + failed;

  return {
    daily,
    webhooks,
    byStatus,
    totals: {
      total,
      sent,
      failed,
      successRate: total === 0 ? 0 : Math.round((sent / total) * 100),
    },
  };
}
