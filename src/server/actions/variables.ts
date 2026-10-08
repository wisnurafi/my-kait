"use server";

/**
 * User variables server actions.
 *
 * Named {tokens} with default values, stored per user and shared across
 * the editor/templates. The editor's {x} picker inserts {name} into the
 * payload; defaultValue pre-fills the per-send custom-variables panel.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { userVariables } from "@/lib/schema";
import { eq, and, asc, count } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { getActionT } from "@/server/i18n";
import { BUILTIN_VARIABLE_NAMES } from "@/lib/template-vars";

const MAX_VARIABLES_PER_USER = 50;
const MAX_DEFAULT_VALUE_LENGTH = 500;

const variableNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{1,40}$/);

const variableValueSchema = z.string().max(MAX_DEFAULT_VALUE_LENGTH);

// Built-in token names without braces (e.g. "tanggal"), reserved so a
// stored variable can never shadow a built-in at substitution time.
const RESERVED_NAMES = new Set(
  BUILTIN_VARIABLE_NAMES.map((token) => token.slice(1, -1)),
);

export type UserVariable = {
  id: string;
  name: string;
  defaultValue: string;
  createdAt: Date;
};

function toPublic(row: typeof userVariables.$inferSelect): UserVariable {
  return {
    id: row.id,
    name: row.name,
    defaultValue: row.defaultValue,
    createdAt: row.createdAt,
  };
}

/** Normalize raw input: trim, strip a single surrounding {…} pair, then validate format. */
function normalizeName(raw: string): string | null {
  let name = raw.trim();
  if (name.startsWith("{") && name.endsWith("}") && name.length > 2) {
    name = name.slice(1, -1).trim();
  }
  const parsed = variableNameSchema.safeParse(name);
  if (!parsed.success) return null;
  return parsed.data;
}

/* --- List the caller's variables, alphabetical --- */
export async function listVariablesAction(): Promise<UserVariable[]> {
  const user = await requireAuth();

  const rows = await db
    .select()
    .from(userVariables)
    .where(eq(userVariables.userId, user.id))
    .orderBy(asc(userVariables.name));

  return rows.map(toPublic);
}

/* --- Create a variable --- */
export async function createVariableAction(input: {
  name: string;
  defaultValue?: string;
}): Promise<{ error: string } | { variable: UserVariable }> {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const name = normalizeName(input.name ?? "");
  if (!name) return { error: t("variableNameInvalid") };
  if (RESERVED_NAMES.has(name)) return { error: t("variableNameReserved") };

  const valueParsed = variableValueSchema.safeParse(input.defaultValue ?? "");
  if (!valueParsed.success) return { error: t("variableValueTooLong") };

  // Unique per user
  const existing = await db
    .select({ id: userVariables.id })
    .from(userVariables)
    .where(
      and(
        eq(userVariables.userId, user.id),
        eq(userVariables.name, name),
      ),
    )
    .limit(1);
  if (existing.length > 0) return { error: t("variableExists") };

  // Cap per user
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(userVariables)
    .where(eq(userVariables.userId, user.id));
  if (Number(total) >= MAX_VARIABLES_PER_USER) {
    return { error: t("variableLimitReached") };
  }

  const [created] = await db
    .insert(userVariables)
    .values({ userId: user.id, name, defaultValue: valueParsed.data })
    .returning();

  revalidatePath("/settings");
  return { variable: toPublic(created) };
}

/* --- Update a variable's name and/or default value --- */
export async function updateVariableAction(
  id: string,
  input: { name?: string; defaultValue?: string },
): Promise<{ error: string } | { variable: UserVariable }> {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const existing = await db
    .select()
    .from(userVariables)
    .where(
      and(
        eq(userVariables.id, id),
        eq(userVariables.userId, user.id),
      ),
    )
    .limit(1);
  if (existing.length === 0) return { error: t("variableNotFound") };

  const patch: { name?: string; defaultValue?: string } = {};

  if (input.name !== undefined) {
    const name = normalizeName(input.name);
    if (!name) return { error: t("variableNameInvalid") };
    if (RESERVED_NAMES.has(name)) return { error: t("variableNameReserved") };
    if (name !== existing[0].name) {
      const clash = await db
        .select({ id: userVariables.id })
        .from(userVariables)
        .where(
          and(
            eq(userVariables.userId, user.id),
            eq(userVariables.name, name),
          ),
        )
        .limit(1);
      if (clash.length > 0) return { error: t("variableExists") };
    }
    patch.name = name;
  }

  if (input.defaultValue !== undefined) {
    const valueParsed = variableValueSchema.safeParse(input.defaultValue);
    if (!valueParsed.success) return { error: t("variableValueTooLong") };
    patch.defaultValue = valueParsed.data;
  }

  if (Object.keys(patch).length === 0) {
    return { variable: toPublic(existing[0]) };
  }

  const [updated] = await db
    .update(userVariables)
    .set(patch)
    .where(eq(userVariables.id, id))
    .returning();

  revalidatePath("/settings");
  return { variable: toPublic(updated) };
}

/* --- Delete a variable --- */
export async function deleteVariableAction(
  id: string,
): Promise<{ error: string } | { deleted: true }> {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const existing = await db
    .select({ id: userVariables.id })
    .from(userVariables)
    .where(
      and(
        eq(userVariables.id, id),
        eq(userVariables.userId, user.id),
      ),
    )
    .limit(1);
  if (existing.length === 0) return { error: t("variableNotFound") };

  await db.delete(userVariables).where(eq(userVariables.id, id));

  revalidatePath("/settings");
  return { deleted: true };
}
