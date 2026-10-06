"use server";

/**
 * Dashboard statistics server actions.
 * Phase 4: statistics dashboard backed by message_logs.
 */

import { db } from "@/lib/db";
import { messageLogs, webhooks as webhooksTable, templates as templatesTable } from "@/lib/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export type DailyStat = { date: string; total: number; sent: number; failed: number };
export type WebhookStat = {
  webhookId: string | null;
  name: string;
  total: number;
  sent: number;
  failed: number;
};
export type StatusStat = { status: string; count: number };

export async function getDashboardStats(): Promise<{
  daily: DailyStat[];
  webhooks: WebhookStat[];
  byStatus: StatusStat[];
  totals: { total: number; sent: number; failed: number; successRate: number };
  deltas: {
    sentPct: number | null;
    rateDelta: number | null;
    webhooksNew: number;
    templates: number;
    templatesNew: number;
  };
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

  /* --- Stat card deltas: week-over-week + new-this-month (cheap counts) --- */
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [wowRows, newCounts] = await Promise.all([
    db
      .select({
        sentNow: sql<number>`count(*) filter (where ${messageLogs.createdAt} >= ${weekAgo} and ${messageLogs.status} in ('sent','edited'))::int`,
        failedNow: sql<number>`count(*) filter (where ${messageLogs.createdAt} >= ${weekAgo} and ${messageLogs.status} in ('failed','rate_limited'))::int`,
        sentPrev: sql<number>`count(*) filter (where ${messageLogs.createdAt} >= ${twoWeeksAgo} and ${messageLogs.createdAt} < ${weekAgo} and ${messageLogs.status} in ('sent','edited'))::int`,
        failedPrev: sql<number>`count(*) filter (where ${messageLogs.createdAt} >= ${twoWeeksAgo} and ${messageLogs.createdAt} < ${weekAgo} and ${messageLogs.status} in ('failed','rate_limited'))::int`,
      })
      .from(messageLogs)
      .where(eq(messageLogs.userId, user.id)),
    Promise.all([
      db
        .select({ n: sql<number>`count(*) filter (where ${webhooksTable.createdAt} >= ${monthStart})::int` })
        .from(webhooksTable)
        .where(eq(webhooksTable.userId, user.id)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          newThisMonth: sql<number>`count(*) filter (where ${templatesTable.createdAt} >= ${monthStart})::int`,
        })
        .from(templatesTable)
        .where(eq(templatesTable.userId, user.id)),
    ]),
  ]);
  const w = wowRows[0] ?? { sentNow: 0, failedNow: 0, sentPrev: 0, failedPrev: 0 };
  const deliveredNow = w.sentNow + w.failedNow;
  const deliveredPrev = w.sentPrev + w.failedPrev;
  const rateNow = deliveredNow > 0 ? (w.sentNow / deliveredNow) * 100 : 0;
  const ratePrev = deliveredPrev > 0 ? (w.sentPrev / deliveredPrev) * 100 : 0;

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
    deltas: {
      // % change in sent messages vs previous 7 days.
      // null = no data at all; 100 = new activity (prev 0, now > 0).
      sentPct:
        w.sentPrev > 0
          ? Math.round(((w.sentNow - w.sentPrev) / w.sentPrev) * 100)
          : w.sentNow > 0
            ? 100
            : null,
      // success-rate change in points vs previous 7 days, 1 decimal.
      // null = no data at all; 100 = new activity (prev empty, now > 0).
      rateDelta:
        deliveredPrev > 0
          ? deliveredNow > 0
            ? Math.round((rateNow - ratePrev) * 10) / 10
            : null
          : deliveredNow > 0
            ? 100
            : null,
      webhooksNew: newCounts[0][0]?.n ?? 0,
      templates: newCounts[1][0]?.total ?? 0,
      templatesNew: newCounts[1][0]?.newThisMonth ?? 0,
    },
  };
}
