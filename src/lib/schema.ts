/**
 * Database schema for My Kait.
 * See PRD section 6.2 for data model details.
 *
 * Tables:
 * - users
 * - webhooks (encrypted URL)
 * - webhook_checks (ping history)
 * - templates
 * - template_folders
 * - template_shares
 * - template_reports
 * - message_logs
 * - api_keys (public REST API keys, SHA-256 hash only — raw key never stored)
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* --- Enums --- */

export const webhookStatusEnum = pgEnum("webhook_status", [
  "active",
  "invalid",
  "rate_limited",
  "unchecked",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "sent",
  "failed",
  "rate_limited",
  "edited",
  "deleted",
]);

export const messageModeEnum = pgEnum("message_mode", [
  "normal",
  "embed",
  "both",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "reviewed",
  "dismissed",
  "actioned",
]);

/* --- Tables --- */

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  avatar: text("avatar"),
  globalName: text("global_name"),
  isSuspended: boolean("is_suspended").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhooks = pgTable(
  "webhooks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => templateFolders.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    discordWebhookId: text("discord_webhook_id"),
    urlEncrypted: text("url_encrypted").notNull(),
    keyVersion: text("key_version").notNull(),
    lastStatus: webhookStatusEnum("last_status").notNull().default("unchecked"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    channelId: text("channel_id"),
    channelName: text("channel_name"),
    guildId: text("guild_id"),
    guildName: text("guild_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => ({
    userIdx: index("webhooks_user_id_idx").on(table.userId),
    discordIdIdx: index("webhooks_discord_webhook_id_idx").on(table.discordWebhookId),
    nameIdx: index("webhooks_name_idx").on(table.userId, table.name),
  }),
);

export const webhookChecks = pgTable(
  "webhook_checks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    status: webhookStatusEnum("status").notNull(),
    httpStatus: integer("http_status"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    webhookIdx: index("webhook_checks_webhook_id_idx").on(table.webhookId),
    createdIdx: index("webhook_checks_created_at_idx").on(table.createdAt),
  }),
);

export const templateFolders = pgTable(
  "template_folders",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("template_folders_user_id_idx").on(table.userId),
    nameIdx: index("template_folders_name_idx").on(table.userId, table.name),
  }),
);

export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => templateFolders.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    tags: text("tags").array().default([]),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("templates_user_id_idx").on(table.userId),
    nameIdx: index("templates_name_idx").on(table.userId, table.name),
    folderIdx: index("templates_folder_id_idx").on(table.folderId),
  }),
);

export const templateShares = pgTable(
  "template_shares",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    importCount: integer("import_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("template_shares_slug_idx").on(table.slug),
  }),
);

export const templateReports = pgTable(
  "template_reports",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    reporterUserId: text("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    templateIdx: index("template_reports_template_id_idx").on(table.templateId),
    statusIdx: index("template_reports_status_idx").on(table.status),
  }),
);

/* --- Admin audit log (single admin; append-only) --- */
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    adminEmail: text("admin_email").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    createdIdx: index("admin_audit_logs_created_at_idx").on(table.createdAt),
    actionIdx: index("admin_audit_logs_action_idx").on(table.action),
  }),
);

export const messageLogs = pgTable(
  "message_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    webhookId: text("webhook_id").references(() => webhooks.id, {
      onDelete: "set null",
    }),
    webhookNameSnapshot: text("webhook_name_snapshot").notNull(),
    // For manual URL sends: store encrypted URL so edit/delete work without saved webhook
    manualUrlEncrypted: text("manual_url_encrypted"),
    manualUrlKeyVersion: text("manual_url_key_version"),
    mode: messageModeEnum("mode").notNull(),
    payload: jsonb("payload"),
    status: messageStatusEnum("status").notNull(),
    httpStatus: integer("http_status"),
    latencyMs: integer("latency_ms"),
    discordMessageId: text("discord_message_id"),
    error: text("error"),
    source: text("source").notNull().default("send"), // send | edit | delete | resend
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("message_logs_user_created_idx").on(table.userId, table.createdAt),
    userStatusIdx: index("message_logs_user_status_idx").on(table.userId, table.status),
    webhookIdx: index("message_logs_webhook_id_idx").on(table.webhookId),
    idempotencyIdx: uniqueIndex("message_logs_idempotency_idx").on(
      table.userId,
      table.idempotencyKey,
    ),
  }),
);

/* --- Relations --- */

export const usersRelations = relations(users, ({ many }) => ({
  webhooks: many(webhooks),
  templates: many(templates),
  templateFolders: many(templateFolders),
  messageLogs: many(messageLogs),
  apiKeys: many(apiKeys),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  user: one(users, { fields: [webhooks.userId], references: [users.id] }),
  checks: many(webhookChecks),
  healthAlerts: many(webhookHealthAlerts),
  messageLogs: many(messageLogs),
}));

export const webhookChecksRelations = relations(webhookChecks, ({ one }) => ({
  webhook: one(webhooks, { fields: [webhookChecks.webhookId], references: [webhooks.id] }),
}));

/* --- Webhook health alerts (from scheduled health monitor) --- */

export const webhookHealthAlerts = pgTable(
  "webhook_health_alerts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message"),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("webhook_health_alerts_user_id_idx").on(table.userId),
    webhookIdx: index("webhook_health_alerts_webhook_id_idx").on(table.webhookId),
  }),
);

export const webhookHealthAlertsRelations = relations(webhookHealthAlerts, ({ one }) => ({
  user: one(users, { fields: [webhookHealthAlerts.userId], references: [users.id] }),
  webhook: one(webhooks, { fields: [webhookHealthAlerts.webhookId], references: [webhooks.id] }),
}));

/* --- API keys (public REST API auth) ---
 *
 * Only the SHA-256 hash of the key is stored. The raw key (mk_live_...)
 * is shown to the user ONCE at creation and never persisted or logged.
 */

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    name: text("name").notNull(),
    scopes: text("scopes")
      .array()
      .notNull()
      .$defaultFn(() => ["send"]),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("api_keys_user_id_idx").on(table.userId),
  }),
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const templateFoldersRelations = relations(templateFolders, ({ one, many }) => ({
  user: one(users, { fields: [templateFolders.userId], references: [users.id] }),
  templates: many(templates),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(users, { fields: [templates.userId], references: [users.id] }),
  folder: one(templateFolders, {
    fields: [templates.folderId],
    references: [templateFolders.id],
  }),
  shares: many(templateShares),
  reports: many(templateReports),
}));

export const templateSharesRelations = relations(templateShares, ({ one }) => ({
  template: one(templates, { fields: [templateShares.templateId], references: [templates.id] }),
}));

export const templateReportsRelations = relations(templateReports, ({ one }) => ({
  template: one(templates, { fields: [templateReports.templateId], references: [templates.id] }),
  reporter: one(users, { fields: [templateReports.reporterUserId], references: [users.id] }),
}));

export const messageLogsRelations = relations(messageLogs, ({ one }) => ({
  user: one(users, { fields: [messageLogs.userId], references: [users.id] }),
  webhook: one(webhooks, { fields: [messageLogs.webhookId], references: [webhooks.id] }),
}));

export type WebhookHealthAlert = typeof webhookHealthAlerts.$inferSelect;
export type NewWebhookHealthAlert = typeof webhookHealthAlerts.$inferInsert;
export type TemplateReport = typeof templateReports.$inferSelect;
export type NewTemplateReport = typeof templateReports.$inferInsert;

/* --- Type aliases for enums --- */

export type WebhookStatus = (typeof webhookStatusEnum.enumValues)[number];
export type MessageStatus = (typeof messageStatusEnum.enumValues)[number];
export type MessageMode = (typeof messageModeEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];

/* --- Types --- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookCheck = typeof webhookChecks.$inferSelect;
export type NewWebhookCheck = typeof webhookChecks.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type TemplateFolder = typeof templateFolders.$inferSelect;
export type NewTemplateFolder = typeof templateFolders.$inferInsert;
export type TemplateShare = typeof templateShares.$inferSelect;
export type MessageLog = typeof messageLogs.$inferSelect;
export type NewMessageLog = typeof messageLogs.$inferInsert;
