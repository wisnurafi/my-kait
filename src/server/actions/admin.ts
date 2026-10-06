"use server";

/**
 * Admin dashboard data actions.
 * Every action starts with requireAdmin() — the admin session cookie is
 * verified here too (defense in depth; middleware also guards the routes).
 */

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  users,
  templates,
  templateShares,
  templateReports,
  messageLogs,
  webhooks,
  webhookChecks,
  adminAuditLogs,
  type ReportStatus,
} from "@/lib/schema";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-session";
import { eq, and, gte, sql, desc, ilike, or, count } from "drizzle-orm";
import { logger } from "@/lib/logger";

export type { ReportStatus } from "@/lib/schema";

export async function requireAdmin(): Promise<string> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  const email = await verifyAdminSession(token);
  if (!email) throw new Error("UNAUTHORIZED");
  return email;
}

/**
 * Append-only admin audit log. Call after every mutating admin action.
 * Never throws: if the audit insert fails, the admin action that already
 * happened must not be reported as failed. The failure is logged instead.
 */
export async function logAdminAction(
  action: string,
  targetType?: string | null,
  targetId?: string | null,
  detail?: string | null,
): Promise<void> {
  try {
    const adminEmail = await requireAdmin();
    await db.insert(adminAuditLogs).values({
      adminEmail,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      detail: detail ?? null,
    });
  } catch (err) {
    logger.error("admin-audit", `failed to record audit for ${action}`, err);
  }
}

const VALID_STATUSES: ReportStatus[] = [
  "pending",
  "reviewed",
  "dismissed",
  "actioned",
];

/* --- Overview --- */

export type AdminOverview = {
  users: number;
  templates: number;
  activeShares: number;
  messages7d: number;
  pendingReports: number;
  webhooksDown: number;
  failedChecks24h: number;
  failedMessages24h: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireAdmin();
  const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const d1 = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [[u], [t], [s], [m], [r], [wd], [fc], [fm]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(templates),
    db
      .select({ n: count() })
      .from(templateShares)
      .where(eq(templateShares.isActive, true)),
    db
      .select({ n: count() })
      .from(messageLogs)
      .where(gte(messageLogs.createdAt, d7)),
    db
      .select({ n: count() })
      .from(templateReports)
      .where(eq(templateReports.status, "pending")),
    db
      .select({ n: count() })
      .from(webhooks)
      .where(eq(webhooks.lastStatus, "invalid")),
    db
      .select({ n: count() })
      .from(webhookChecks)
      .where(
        and(
          eq(webhookChecks.status, "invalid"),
          gte(webhookChecks.createdAt, d1),
        ),
      ),
    db
      .select({ n: count() })
      .from(messageLogs)
      .where(
        and(
          sql`${messageLogs.status} in ('failed','rate_limited')`,
          gte(messageLogs.createdAt, d1),
        ),
      ),
  ]);

  return {
    users: u.n,
    templates: t.n,
    activeShares: s.n,
    messages7d: m.n,
    pendingReports: r.n,
    webhooksDown: wd.n,
    failedChecks24h: fc.n,
    failedMessages24h: fm.n,
  };
}

export async function getPendingReportsCount(): Promise<number> {
  await requireAdmin();
  const [row] = await db
    .select({ n: count() })
    .from(templateReports)
    .where(eq(templateReports.status, "pending"));
  return row.n;
}

/* --- Reports queue --- */

export type AdminReport = {
  id: string;
  reason: string;
  status: ReportStatus;
  createdAt: Date;
  templateId: string;
  templateName: string;
  templateSlug: string | null;
  shareActive: boolean | null;
  reporterId: string | null;
  reporterName: string | null;
  reportCount: number;
};

export async function getReports(
  status?: ReportStatus,
): Promise<AdminReport[]> {
  await requireAdmin();
  const rows = await db
    .select({
      id: templateReports.id,
      reason: templateReports.reason,
      status: templateReports.status,
      createdAt: templateReports.createdAt,
      templateId: templateReports.templateId,
      templateName: templates.name,
      reporterId: users.id,
      reporterName: users.username,
      shareSlug: templateShares.slug,
      // True share status. The join above only matches ACTIVE shares (its slug
      // feeds the /t/ link), so without this separate check shareActive could
      // never be false and the "unshared" badge never rendered.
      shareActive: sql<boolean | null>`(
        select ${templateShares.isActive} from ${templateShares}
        where ${templateShares.templateId} = ${templates.id}
        order by ${templateShares.createdAt} desc
        limit 1
      )`,
      reportCount: sql<number>`(
        select count(*)::int from ${templateReports} r2
        where r2.template_id = ${templateReports.templateId}
          and r2.status = 'pending'
      )`,
    })
    .from(templateReports)
    .innerJoin(templates, eq(templateReports.templateId, templates.id))
    .leftJoin(users, eq(templateReports.reporterUserId, users.id))
    .leftJoin(
      templateShares,
      and(
        eq(templateShares.templateId, templates.id),
        eq(templateShares.isActive, true),
      ),
    )
    .where(status ? eq(templateReports.status, status) : undefined)
    .orderBy(desc(templateReports.createdAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt,
    templateId: r.templateId,
    templateName: r.templateName,
    templateSlug: r.shareSlug,
    shareActive: r.shareActive,
    reporterId: r.reporterId,
    reporterName: r.reporterName,
    reportCount: r.reportCount,
  }));
}

export async function setReportStatus(
  reportId: string,
  status: ReportStatus,
): Promise<{ success: boolean }> {
  await requireAdmin();
  if (!VALID_STATUSES.includes(status)) throw new Error("INVALID_STATUS");
  await db
    .update(templateReports)
    .set({ status })
    .where(eq(templateReports.id, reportId));
  await logAdminAction(`report.${status}`, "report", reportId);
  return { success: true };
}

/**
 * Mark a report "actioned" AND unpublish the template's share link
 * (share stays in DB with is_active=false; owner's template untouched).
 */
export async function actionReport(
  reportId: string,
): Promise<{ success: boolean }> {
  await requireAdmin();
  const [report] = await db
    .select({
      templateId: templateReports.templateId,
      templateName: templates.name,
    })
    .from(templateReports)
    .innerJoin(templates, eq(templateReports.templateId, templates.id))
    .where(eq(templateReports.id, reportId))
    .limit(1);
  if (!report) throw new Error("NOT_FOUND");
  await db
    .update(templateReports)
    .set({ status: "actioned" })
    .where(eq(templateReports.id, reportId));
  await db
    .update(templateShares)
    .set({ isActive: false })
    .where(eq(templateShares.templateId, report.templateId));
  await logAdminAction(
    "report.actioned",
    "report",
    reportId,
    `Template "${report.templateName}" unpublished`,
  );
  return { success: true };
}

/* --- Shared templates --- */

export type AdminShare = {
  id: string;
  slug: string;
  isActive: boolean;
  importCount: number;
  createdAt: Date;
  templateId: string;
  templateName: string;
  ownerId: string;
  ownerName: string;
  pendingReports: number;
};

export async function getShares(
  query?: string,
  isActive?: boolean,
): Promise<AdminShare[]> {
  await requireAdmin();
  const q = query?.trim();
  const rows = await db
    .select({
      id: templateShares.id,
      slug: templateShares.slug,
      isActive: templateShares.isActive,
      importCount: templateShares.importCount,
      createdAt: templateShares.createdAt,
      templateId: templates.id,
      templateName: templates.name,
      ownerId: users.id,
      ownerName: users.username,
      pendingReports: sql<number>`(
        select count(*)::int from ${templateReports} r
        where r.template_id = ${templates.id} and r.status = 'pending'
      )`,
    })
    .from(templateShares)
    .innerJoin(templates, eq(templateShares.templateId, templates.id))
    .innerJoin(users, eq(templates.userId, users.id))
    .where(
      and(
        q
          ? or(
              ilike(templates.name, `%${q}%`),
              ilike(templateShares.slug, `%${q}%`),
              ilike(users.username, `%${q}%`),
            )
          : undefined,
        isActive !== undefined
          ? eq(templateShares.isActive, isActive)
          : undefined,
      ),
    )
    .orderBy(desc(templateShares.createdAt))
    .limit(200);
  return rows;
}

export async function setShareActive(
  shareId: string,
  active: boolean,
): Promise<{ success: boolean }> {
  await requireAdmin();
  const [share] = await db
    .select({ slug: templateShares.slug })
    .from(templateShares)
    .where(eq(templateShares.id, shareId))
    .limit(1);
  await db
    .update(templateShares)
    .set({ isActive: active })
    .where(eq(templateShares.id, shareId));
  await logAdminAction(
    active ? "share.enabled" : "share.disabled",
    "share",
    shareId,
    share ? `/t/${share.slug}` : null,
  );
  return { success: true };
}

/* --- Users (read-only) --- */

export type AdminUser = {
  id: string;
  username: string;
  globalName: string | null;
  discordId: string;
  isSuspended: boolean;
  createdAt: Date;
  templateCount: number;
  webhookCount: number;
  messageCount: number;
};

export async function getAdminUsers(
  query?: string,
  suspended?: boolean,
): Promise<AdminUser[]> {
  await requireAdmin();
  const q = query?.trim();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      globalName: users.globalName,
      discordId: users.discordId,
      isSuspended: users.isSuspended,
      createdAt: users.createdAt,
      templateCount: sql<number>`(
        select count(*)::int from ${templates} t where t.user_id = ${users.id}
      )`,
      webhookCount: sql<number>`(
        select count(*)::int from ${webhooks} w where w.user_id = ${users.id}
      )`,
      messageCount: sql<number>`(
        select count(*)::int from ${messageLogs} m where m.user_id = ${users.id}
      )`,
    })
    .from(users)
    .where(
      and(
        q
          ? or(
              ilike(users.username, `%${q}%`),
              ilike(users.discordId, `%${q}%`),
            )
          : undefined,
        suspended !== undefined
          ? eq(users.isSuspended, suspended)
          : undefined,
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(200);
  return rows;
}

/* --- Stronger moderation --- */

/**
 * Permanently delete a template (cascades to its shares and reports).
 * The owner's other data is untouched.
 */
export async function deleteTemplate(
  templateId: string,
): Promise<{ success: boolean }> {
  await requireAdmin();
  const [tpl] = await db
    .select({ name: templates.name, userId: templates.userId })
    .from(templates)
    .where(eq(templates.id, templateId))
    .limit(1);
  if (!tpl) throw new Error("NOT_FOUND");
  await db.delete(templates).where(eq(templates.id, templateId));
  await logAdminAction(
    "template.deleted",
    "template",
    templateId,
    `Template "${tpl.name}" permanently deleted`,
  );
  return { success: true };
}

/**
 * Suspend/unsuspend a user. Suspended users cannot sign in (enforced in
 * Auth.js callbacks) and all their public shares are unpublished at once.
 * Unsuspending does NOT re-publish shares — re-enable them manually.
 */
export async function setUserSuspended(
  userId: string,
  suspended: boolean,
): Promise<{ success: boolean }> {
  await requireAdmin();
  const [u] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) throw new Error("NOT_FOUND");
  await db
    .update(users)
    .set({ isSuspended: suspended })
    .where(eq(users.id, userId));
  if (suspended) {
    // Unpublish all their shares in one go
    await db
      .update(templateShares)
      .set({ isActive: false })
      .where(
        sql`${templateShares.templateId} in (select ${templates.id} from ${templates} where ${templates.userId} = ${userId})`,
      );
  }
  await logAdminAction(
    suspended ? "user.suspended" : "user.unsuspended",
    "user",
    userId,
    `@${u.username}${suspended ? " — shares unpublished" : ""}`,
  );
  return { success: true };
}

/* --- Audit log --- */

export type AuditEntry = {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: Date;
};

export type AuditCategory = "all" | "report" | "share" | "template" | "user" | "admin";

export async function getAuditLogs(
  category?: AuditCategory,
  page = 1,
  pageSize = 15,
): Promise<{ logs: AuditEntry[]; total: number; page: number; totalPages: number }> {
  await requireAdmin();
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));
  const filter =
    category && category !== "all"
      ? ilike(adminAuditLogs.action, `${category}.%`)
      : undefined;
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: adminAuditLogs.id,
        adminEmail: adminAuditLogs.adminEmail,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        detail: adminAuditLogs.detail,
        createdAt: adminAuditLogs.createdAt,
      })
      .from(adminAuditLogs)
      .where(filter)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(safeSize)
      .offset((safePage - 1) * safeSize),
    db.select({ n: count() }).from(adminAuditLogs).where(filter),
  ]);
  const total = totalRows[0]?.n ?? 0;
  return {
    logs: rows,
    total,
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / safeSize)),
  };
}

/* --- Activity charts (overview) --- */

export type AdminDaily = {
  date: string;
  sent: number;
  failed: number;
  users: number;
};

/**
 * Per-day activity for the last N days (global, all users).
 * sent = ('sent','edited'), failed = ('failed','rate_limited') —
 * 'deleted' is excluded from both, same as the user dashboard.
 */
export async function getAdminActivity(days = 30): Promise<AdminDaily[]> {
  await requireAdmin();
  // This is exported from a "use server" module, so a client could call it
  // with an arbitrary value — clamp to a sane range to bound the work.
  const safeDays = Math.min(Math.max(Math.floor(days) || 30, 1), 90);
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const day = (
    col: typeof messageLogs.createdAt | typeof users.createdAt,
  ) => sql<string>`to_char(${col}, 'YYYY-MM-DD')`;

  const [msgs, usrs] = await Promise.all([
    db
      .select({
        date: day(messageLogs.createdAt),
        sent: sql<number>`count(*) filter (where ${messageLogs.status} in ('sent','edited'))::int`,
        failed: sql<number>`count(*) filter (where ${messageLogs.status} in ('failed','rate_limited'))::int`,
      })
      .from(messageLogs)
      .where(gte(messageLogs.createdAt, since))
      .groupBy(day(messageLogs.createdAt)),
    db
      .select({
        date: day(users.createdAt),
        n: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(gte(users.createdAt, since))
      .groupBy(day(users.createdAt)),
  ]);

  const byDate = new Map<string, AdminDaily>();
  for (let i = safeDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    byDate.set(key, { date: key, sent: 0, failed: 0, users: 0 });
  }
  for (const m of msgs) {
    const row = byDate.get(m.date);
    if (row) {
      row.sent = m.sent;
      row.failed = m.failed;
    }
  }
  for (const u of usrs) {
    const row = byDate.get(u.date);
    if (row) row.users = u.n;
  }
  return [...byDate.values()];
}

export type AdminUserDetail = {
  id: string;
  username: string;
  globalName: string | null;
  discordId: string;
  isSuspended: boolean;
  createdAt: Date;
  templates: {
    id: string;
    name: string;
    createdAt: Date;
    shareSlug: string | null;
    shareActive: boolean | null;
    pendingReports: number;
  }[];
  webhooks: { id: string; name: string; lastStatus: string }[];
  recentLogs: { id: string; status: string; createdAt: Date }[];
};

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  await requireAdmin();
  const [u] = await db
    .select({
      id: users.id,
      username: users.username,
      globalName: users.globalName,
      discordId: users.discordId,
      isSuspended: users.isSuspended,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) throw new Error("NOT_FOUND");

  const [tpls, whs, logs] = await Promise.all([
    db
      .select({
        id: templates.id,
        name: templates.name,
        createdAt: templates.createdAt,
        shareSlug: templateShares.slug,
        shareActive: templateShares.isActive,
        pendingReports: sql<number>`(
          select count(*)::int from ${templateReports} r
          where r.template_id = ${templates.id} and r.status = 'pending'
        )`,
      })
      .from(templates)
      .leftJoin(
        templateShares,
        and(
          eq(templateShares.templateId, templates.id),
          eq(templateShares.isActive, true),
        ),
      )
      .where(eq(templates.userId, userId))
      .orderBy(desc(templates.createdAt))
      .limit(100),
    db
      .select({
        id: webhooks.id,
        name: webhooks.name,
        lastStatus: webhooks.lastStatus,
      })
      .from(webhooks)
      .where(eq(webhooks.userId, userId))
      .orderBy(desc(webhooks.createdAt))
      .limit(100),
    db
      .select({
        id: messageLogs.id,
        status: messageLogs.status,
        createdAt: messageLogs.createdAt,
      })
      .from(messageLogs)
      .where(eq(messageLogs.userId, userId))
      .orderBy(desc(messageLogs.createdAt))
      .limit(10),
  ]);

  return { ...u, templates: tpls, webhooks: whs, recentLogs: logs };
}
