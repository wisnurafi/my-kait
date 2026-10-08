/**
 * payloadPreview — one-line text excerpt of a Discord message payload.
 * Shared helper (plain lib file) because "use server" action files may only
 * export async functions, so this cannot live in templates.ts.
 */

/** Cuplikan isi pesan (content / embed pertama), maks ~140 karakter. */
export function payloadPreview(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const content = typeof p.content === "string" ? p.content.trim() : "";
  if (content) return content.slice(0, 140);
  const embeds = Array.isArray(p.embeds) ? p.embeds : [];
  const em = embeds[0] as Record<string, unknown> | undefined;
  const title = typeof em?.title === "string" ? em.title.trim() : "";
  const desc = typeof em?.description === "string" ? em.description.trim() : "";
  return [title, desc].filter(Boolean).join(" — ").slice(0, 140);
}
