/**
 * Zod validation schemas for all inputs.
 * See PRD section 5.4 — "Validasi semua input dengan Zod di server".
 * Discord limits from PRD 3.3 and Discord API docs.
 */

import { z } from "zod";

/**
 * Translator for schema messages. Schemas are built per-request via the
 * factories below so validation errors follow the user's locale.
 * In server actions: `const t = await getActionT("errors"); addWebhookSchema(t).safeParse(...)`
 */
type SchemaT = (key: string) => string;

/* --- Webhook management --- */

export const webhookUrlSchema = (t: SchemaT) =>
  z
    .string()
    .url(t("urlInvalid"))
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          const allowed = [
            "discord.com",
            "discordapp.com",
            "ptb.discord.com",
            "ptb.discordapp.com",
            "canary.discord.com",
            "canary.discordapp.com",
          ];
          return allowed.includes(parsed.hostname) && /^\/api\/webhooks\/\d+\/[\w-]+$/.test(
            parsed.pathname,
          );
        } catch {
          return false;
        }
      },
      t("webhookUrlInvalid"),
    );

export const addWebhookSchema = (t: SchemaT) =>
  z.object({
    url: webhookUrlSchema(t),
    name: z
      .string()
      .min(1, t("nameRequired"))
      .max(100, t("nameTooLong")),
  });

/**
 * URL umum yang hanya mengizinkan protokol http/https.
 * z.string().url() menerima `javascript:` dan `data:` URL (URL parser bawaan),
 * yang menjadi stored XSS ketika di-render sebagai <a href> di preview & share page.
 */
export const httpUrlSchema = (t: SchemaT) =>
  z
    .string()
    .url(t("urlInvalid"))
    .refine(
      (url) => {
        try {
          const protocol = new URL(url).protocol;
          return protocol === "http:" || protocol === "https:";
        } catch {
          return false;
        }
      },
      t("urlInvalid"),
    );

export const updateWebhookSchema = (t: SchemaT) =>
  z.object({
    id: z.string(),
    name: z
      .string()
      .min(1, t("nameRequired"))
      .max(100, t("nameTooLong")),
  });

/* --- Message payload --- */

// Discord embed field limits
export const embedFieldSchema = z.object({
  name: z.string().min(1).max(256),
  value: z.string().min(1).max(1024),
  inline: z.boolean().optional().default(false),
});

export const embedSchema = (t: SchemaT) =>
  z.object({
    title: z.string().max(256).optional(),
    url: httpUrlSchema(t).optional().or(z.literal("")),
    description: z.string().max(4096).optional(),
    color: z.number().int().min(0).max(0xffffff).optional(),
    author: z
      .object({
        name: z.string().max(256),
        url: httpUrlSchema(t).optional().or(z.literal("")),
        icon_url: httpUrlSchema(t).optional().or(z.literal("")),
      })
      .optional(),
    thumbnail: z
      .object({
        url: httpUrlSchema(t),
      })
      .optional(),
    image: z
      .object({
        url: httpUrlSchema(t),
      })
      .optional(),
    fields: z.array(embedFieldSchema).max(25).optional(),
    footer: z
      .object({
        text: z.string().max(2048),
        icon_url: httpUrlSchema(t).optional().or(z.literal("")),
      })
      .optional(),
    timestamp: z.string().datetime().optional().or(z.boolean()),
  });

// Full embed array validation with total char limit
export const embedsSchema = (t: SchemaT) =>
  z
    .array(embedSchema(t))
    .max(10, t("maxEmbeds"))
    .refine(
      (embeds) => {
        const totalChars = embeds.reduce((sum, e) => {
          return (
            sum +
            (e.title?.length ?? 0) +
            (e.description?.length ?? 0) +
            (e.author?.name?.length ?? 0) +
            (e.footer?.text?.length ?? 0) +
            (e.fields?.reduce((f, field) => f + field.name.length + field.value.length, 0) ?? 0)
          );
        }, 0);
        return totalChars <= 6000;
      },
      t("embedsTooLong"),
    );

export const sendPayloadSchema = (t: SchemaT) =>
  z.object({
    content: z.string().max(2000).optional(),
    username: z.string().max(80).optional(),
    avatar_url: httpUrlSchema(t).optional().or(z.literal("")),
    tts: z.boolean().optional(),
    thread_id: z.string().optional(),
    allowed_mentions: z
      .object({
        parse: z.array(z.enum(["roles", "users", "everyone"])).optional(),
        roles: z.array(z.string()).optional(),
        users: z.array(z.string()).optional(),
        replied_user: z.boolean().optional(),
      })
      .optional(),
    suppress_embeds: z.boolean().optional(),
    embeds: embedsSchema(t).optional(),
    applied_tags: z.array(z.string()).optional(),
  });

export type SendPayload = z.infer<ReturnType<typeof sendPayloadSchema>>;

/* --- Message mode --- */

export const messageModeSchema = z.enum(["normal", "embed", "both"]);

/* --- Send request from editor --- */

export const sendRequestSchema = (t: SchemaT) =>
  z.object({
    webhookId: z.string().optional(), // saved webhook
    manualUrl: webhookUrlSchema(t).optional(), // manual URL
    payload: sendPayloadSchema(t),
    mode: messageModeSchema,
    savePayload: z.boolean().optional().default(true), // log payload or not
  });

/* --- Template --- */

export const templateSchema = (t: SchemaT) =>
  z.object({
    name: z.string().min(1, t("nameRequired")).max(100, t("nameTooLong")),
    description: z.string().max(500).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    payload: sendPayloadSchema(t),
  });

/* --- Log filter params --- */

export const logFilterSchema = z.object({
  status: z
    .enum(["sent", "failed", "rate_limited", "edited", "deleted"])
    .optional(),
  webhookId: z.string().optional(),
  mode: z.enum(["normal", "embed", "both"]).optional(),
  source: z.enum(["send", "edit", "delete", "resend"]).optional(),
  search: z.string().optional(),
  datePreset: z
    .enum(["today", "7d", "30d", "custom"])
    .optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.enum(["newest", "oldest"]).optional().default("newest"),
  page: z.number().int().min(1).optional().default(1),
  perPage: z.number().int().min(1).max(100).optional().default(20),
});

export type LogFilter = z.infer<typeof logFilterSchema>;

/* --- Account deletion --- */

export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE"),
});

/* --- Template report (public; anonymous allowed) --- */

export const reportTemplateSchema = (t: SchemaT) =>
  z.object({
    templateId: z.string().min(1, t("templateInvalid")),
    reason: z
      .string()
      .min(10, t("reasonTooShort"))
      .max(1000, t("reasonTooLong")),
  });

export type ReportTemplateInput = z.infer<ReturnType<typeof reportTemplateSchema>>;
