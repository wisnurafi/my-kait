"use server";

/**
 * Template management server actions.
 * See PRD sections 3.6, 3.7.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { templates, templateShares, templateReports, users } from "@/lib/schema";
import { eq, and, desc, ilike, or, sql, count, arrayContains } from "drizzle-orm";
import { requireAuth, auth } from "@/lib/auth";
import { templateSchema, reportTemplateSchema } from "@/lib/validations";
import { generateSlug } from "@/lib/utils";
import { getActionT } from "@/server/i18n";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { notifyAdminNewReport } from "@/server/admin-notify";

/* --- Create template --- */
export async function createTemplateAction(formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const raw = {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    payload: JSON.parse(String(formData.get("payload") ?? "{}")),
  };

  const parsed = templateSchema(t).safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("payloadInvalid") };
  }

  const [created] = await db
    .insert(templates)
    .values({
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      tags: parsed.data.tags ?? [],
      payload: parsed.data.payload,
    })
    .returning();

  revalidatePath("/templates");
  return { success: true, id: created.id };
}

/* --- Get templates list (paginated) --- */
export async function getTemplates(opts: {
  search?: string;
  tagFilter?: string;
  folderId?: string;
  page?: number;
  perPage?: number;
} = {}) {
  const user = await requireAuth();

  const { search, tagFilter, folderId } = opts;
  const page = Math.max(1, opts.page ?? 1);
  const perPage = Math.min(100, Math.max(1, opts.perPage ?? 12));

  const conditions = [eq(templates.userId, user.id)];

  if (search) {
    conditions.push(ilike(templates.name, `%${search}%`));
  }

  if (folderId === "unfiled") {
    conditions.push(sql`${templates.folderId} IS NULL`);
  } else if (folderId) {
    conditions.push(eq(templates.folderId, folderId));
  }

  // Tag filter in SQL (was JS-side) so the total count stays accurate
  if (tagFilter) {
    conditions.push(arrayContains(templates.tags, [tagFilter]));
  }

  const where = and(...conditions);

  const totalResult = await db
    .select({ total: count() })
    .from(templates)
    .where(where);
  const total = totalResult[0]?.total ?? 0;

  const result = await db
    .select()
    .from(templates)
    .where(where)
    .orderBy(desc(templates.updatedAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  return {
    templates: result,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/* --- Get single template --- */
export async function getTemplate(id: string) {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const result = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.id, id),
        eq(templates.userId, user.id),
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

/* --- Update template --- */
export async function updateTemplateAction(formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "") || undefined;
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!name) return { error: t("nameRequired") };

  // Verify ownership
  const existing = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.id, id),
        eq(templates.userId, user.id),
      ),
    )
    .limit(1);

  if (existing.length === 0) return { error: t("templateNotFound") };

  await db
    .update(templates)
    .set({
      name,
      description: description ?? null,
      tags,
      updatedAt: new Date(),
    })
    .where(eq(templates.id, id));

  revalidatePath("/templates");
  return { success: true };
}

/* --- Duplicate template --- */
export async function duplicateTemplateAction(formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");
  const id = String(formData.get("id") ?? "");

  const existing = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.id, id),
        eq(templates.userId, user.id),
      ),
    )
    .limit(1);

  if (existing.length === 0) return { error: t("templateNotFound") };

  await db.insert(templates).values({
    userId: user.id,
    name: `${existing[0].name} (salinan)`,
    description: existing[0].description,
    tags: existing[0].tags,
    payload: existing[0].payload,
  });

  revalidatePath("/templates");
  return { success: true };
}

/* --- Delete template --- */
export async function deleteTemplateAction(formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");
  const id = String(formData.get("id") ?? "");

  const existing = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.id, id),
        eq(templates.userId, user.id),
      ),
    )
    .limit(1);

  if (existing.length === 0) return { error: t("templateNotFound") };

  await db.delete(templates).where(eq(templates.id, id));

  revalidatePath("/templates");
  return { success: true };
}

/* --- Save current editor state as template --- */
export async function saveAsTemplateAction(prevState: unknown, formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "") || undefined;
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  let payload;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: t("payloadInvalid") };
  }

  if (!name) return { error: t("nameRequired") };

  const parsed = templateSchema(t).safeParse({ name, description, tags, payload });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("payloadInvalid") };
  }

  await db.insert(templates).values({
    userId: user.id,
    name: parsed.data.name,
    description: parsed.data.description,
    tags: parsed.data.tags ?? [],
    payload: parsed.data.payload,
  });

  revalidatePath("/templates");
  return { success: true, message: t("templateSaved") };
}

/* --- Create share link --- */
export async function createShareLinkAction(formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");
  const templateId = String(formData.get("templateId") ?? "");

  // Verify ownership
  const existing = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.id, templateId),
        eq(templates.userId, user.id),
      ),
    )
    .limit(1);

  if (existing.length === 0) return { error: t("templateNotFound") };

  // Check if already has an active share
  const existingShare = await db
    .select()
    .from(templateShares)
    .where(
      and(
        eq(templateShares.templateId, templateId),
        eq(templateShares.isActive, true),
      ),
    )
    .limit(1);

  if (existingShare.length > 0) {
    return { success: true, slug: existingShare[0].slug };
  }

  const slug = generateSlug();

  await db.insert(templateShares).values({
    templateId,
    slug,
  });

  revalidatePath("/templates");
  return { success: true, slug };
}

/* --- Revoke share link --- */
export async function revokeShareLinkAction(formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");
  const shareId = String(formData.get("shareId") ?? "");

  await db
    .update(templateShares)
    .set({ isActive: false })
    .where(eq(templateShares.id, shareId));

  revalidatePath("/templates");
  return { success: true };
}

/* --- Get share links for a template --- */
export async function getShareLinks(templateId: string) {
  const user = await requireAuth();

  // Verify ownership
  const template = await db
    .select({ id: templates.id })
    .from(templates)
    .where(
      and(
        eq(templates.id, templateId),
        eq(templates.userId, user.id),
      ),
    )
    .limit(1);

  if (template.length === 0) return [];

  return db
    .select()
    .from(templateShares)
    .where(
      and(
        eq(templateShares.templateId, templateId),
        eq(templateShares.isActive, true),
      ),
    )
    .orderBy(desc(templateShares.createdAt));
}

/* --- Get shared template by slug (public) --- */
export async function getSharedTemplateBySlug(slug: string) {
  const t = await getActionT("errors");
  const result = await db
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
      tags: templates.tags,
      payload: templates.payload,
      shareId: templateShares.id,
      importCount: templateShares.importCount,
    })
    .from(templateShares)
    .innerJoin(templates, eq(templateShares.templateId, templates.id))
    .where(
      and(
        eq(templateShares.slug, slug),
        eq(templateShares.isActive, true),
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

/* --- Import template from share --- */
export async function importTemplateAction(formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");
  const shareId = String(formData.get("shareId") ?? "");

  // Get the shared template
  const shared = await db
    .select({
      templateId: templateShares.templateId,
      slug: templateShares.slug,
    })
    .from(templateShares)
    .where(
      and(
        eq(templateShares.id, shareId),
        eq(templateShares.isActive, true),
      ),
    )
    .limit(1);

  if (shared.length === 0) return { error: t("templateNotFound") };

  // Get template data
  const template = await db
    .select()
    .from(templates)
    .where(eq(templates.id, shared[0].templateId))
    .limit(1);

  if (template.length === 0) return { error: t("templateNotFound") };

  // Create a copy for the user
  const [created] = await db
    .insert(templates)
    .values({
      userId: user.id,
      name: template[0].name,
      description: template[0].description,
      tags: template[0].tags,
      payload: template[0].payload,
    })
    .returning();

  // Increment import count
  await db
    .update(templateShares)
    .set({ importCount: sql`${templateShares.importCount} + 1` })
    .where(eq(templateShares.id, shareId));

  return { success: true, id: created.id };
}

/* --- Report a shared template (public; anonymous allowed) --- */

export async function reportTemplateAction(
  _prevState: unknown,
  formData: FormData,
) {
  const t = await getActionT("errors");

  // Rate limit: 5 reports/hour per IP (spam protection)
  const ip = await getClientIp();
  const rl = await checkRateLimit("report", `report:${ip}`);
  if (!rl.success) {
    return { error: t("rateLimited") };
  }

  const parsed = reportTemplateSchema(t).safeParse({
    templateId: String(formData.get("templateId") ?? ""),
    reason: String(formData.get("reason") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("payloadInvalid") };
  }

  // Template must exist (prevents orphan reports)
  const [template] = await db
    .select({ id: templates.id, name: templates.name })
    .from(templates)
    .where(eq(templates.id, parsed.data.templateId))
    .limit(1);
  if (!template) {
    return { error: t("templateNotFound") };
  }

  // Anonymous allowed — attach reporter id when logged in
  const session = await auth();

  await db.insert(templateReports).values({
    templateId: parsed.data.templateId,
    reporterUserId: session?.user?.id ?? null,
    reason: parsed.data.reason,
  });

  // Ping the admin on Discord (fire-and-forget; never breaks the report).
  // Review link is built from the request host so it always matches the
  // environment the report was filed on (env.AUTH_URL may be unset).
  let reporterName: string | null = null;
  if (session?.user?.id) {
    const [u] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    reporterName = u?.username ?? null;
  }
  const reqHeaders = await headers();
  const reqHost =
    reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host") ?? "";
  const reqProto =
    reqHeaders.get("x-forwarded-proto") ??
    (reqHost.startsWith("localhost") ? "http" : "https");
  const reviewUrl = `${reqProto}://${reqHost}/id/admin/reports?status=pending`;
  await notifyAdminNewReport(
    {
      templateName: template.name,
      reporterName,
      reason: parsed.data.reason,
    },
    reviewUrl,
  );

  return { success: true };
}

/* --- Public gallery: list active shared templates (public, no auth) --- */
export type GalleryTemplate = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  importCount: number;
  author: string;
  sharedAt: Date;
};

export async function getGalleryTemplates(opts: {
  search?: string;
  sort?: "popular" | "latest";
  limit?: number;
}): Promise<GalleryTemplate[]> {
  const { search, sort = "popular", limit = 48 } = opts;

  const conditions = [eq(templateShares.isActive, true)];

  const q = search?.trim();
  if (q) {
    const pattern = `%${q}%`;
    const match = or(
      ilike(templates.name, pattern),
      ilike(templates.description, pattern),
      sql`array_to_string(${templates.tags}, ' ') ilike ${pattern}`,
    );
    if (match) conditions.push(match);
  }

  const orderBy =
    sort === "latest"
      ? desc(templateShares.createdAt)
      : desc(templateShares.importCount);

  const rows = await db
    .select({
      slug: templateShares.slug,
      name: templates.name,
      description: templates.description,
      tags: templates.tags,
      importCount: templateShares.importCount,
      author: users.username,
      sharedAt: templateShares.createdAt,
    })
    .from(templateShares)
    .innerJoin(templates, eq(templateShares.templateId, templates.id))
    .innerJoin(users, eq(templates.userId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit);

  return rows;
}

/* --- Distinct tags across ALL user templates (for the filter chips) --- */
export async function getAllTemplateTags(): Promise<string[]> {
  const user = await requireAuth();
  const rows = await db
    .select({ tags: templates.tags })
    .from(templates)
    .where(eq(templates.userId, user.id));
  return [...new Set(rows.flatMap((r) => r.tags ?? []))].sort((a, b) =>
    a.localeCompare(b),
  );
}
