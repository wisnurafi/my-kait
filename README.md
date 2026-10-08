# My-Kait

**Ship Discord messages like you ship code.**

My-Kait is a webhook studio for Discord: compose rich messages in a visual editor, preview them exactly as they'll appear, and send them through your webhooks — no bot required. Save reusable templates, schedule messages, monitor webhook health, and browse templates shared by the community.

## Features

- **Visual composer** — write plain text, embeds, or both, with a live Discord-style preview
- **Template library** — save messages as templates, organize with folders and tags, full-text search
- **Full template editing** — open any template in the editor and change everything: name, description, tags, and the message content itself
- **Version history** — manual snapshots (keeps the 20 newest), per-version diff against the current state, one-click restore that also brings back the folder position
- **Template variables** — built-in placeholders like `{tanggal}`, `{waktu}`, `{hari}` (ID/EN aware), plus your own custom `{variables}` that you're prompted to fill in at send time
- **Scheduled messages** — schedule a message for later or on a recurring pattern; dispatched every minute by an external cron job
- **Share links & public gallery** — share any template with a link, or browse community templates without logging in
- **Webhook manager** — add webhooks, automatic health checks, ping history, down/recovered alerts, and organize webhooks into folders
- **Message logs** — every send logged with status, latency, and payload; resend, edit, or delete from the log; filter by status, webhook, mode, source, and date (including custom ranges)
- **Dashboard** — delivery stats, success rate, per-webhook breakdown
- **REST API** — send messages programmatically with per-user API keys (`mk_live_...`); idempotency keys, 5 req/min per key, full reference at `/docs`
- **Admin dashboard** — single-account moderation panel: report queue with Discord notifications, audit log, user management (suspend/delete), shared-template browser, and activity charts
- **Command palette** — press `Ctrl/⌘+K` to jump anywhere or trigger actions
- **Bilingual** — full English / Bahasa Indonesia UI
- **Dark-first design** — precise devtool aesthetic with independent landing/app themes

## Tech stack

| Layer      | Choice                                                              |
| ---------- | ------------------------------------------------------------------- |
| Framework  | [Next.js 16](https://nextjs.org) (App Router), React 19             |
| Styling    | Tailwind CSS v4, custom design tokens                               |
| Database   | PostgreSQL ([Neon](https://neon.tech)) via [Drizzle ORM](https://orm.drizzle.team) |
| Auth       | [Auth.js](https://authjs.dev) with Discord OAuth                    |
| i18n       | [next-intl](https://next-intl.dev) (`id` default, `en`)              |
| Rate limit | [Upstash Redis](https://upstash.com) (optional, skipped when unset) |
| Uploads    | [Vercel Blob](https://vercel.com/storage/blob)                      |
| Fonts      | Space Grotesk / Inter / JetBrains Mono                              |

## Getting started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 12+
- A PostgreSQL database ([Neon](https://neon.tech) works out of the box)
- A Discord application for OAuth ([discord.com/developers/applications](https://discord.com/developers/applications))

### 1. Clone and install

```bash
git clone https://github.com/wisnurafi/My-Kait.git
cd My-Kait
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local` (every variable is documented in `.env.example`):

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | ✅ | Discord OAuth app |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32` |
| `AUTH_URL` | ✅ | `http://localhost:3000` for dev |
| `DATABASE_URL` | ✅ | Pooled Postgres connection string |
| `WEBHOOK_ENCRYPTION_KEY` | ✅ | `openssl rand -hex 32` (64 hex chars) — encrypts stored webhook URLs |
| `WEBHOOK_ENCRYPTION_KEY_VERSION` | ✅ | `1` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | ➖ | Rate limiting; disabled when unset |
| `BLOB_READ_WRITE_TOKEN` | ➖ | Vercel Blob, for image uploads |
| `CRON_SECRET` | ➖ | Protects `/api/cron/*` endpoints |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` | ➖ | Single admin account (see Admin below); admin login disabled when unset |
| `ADMIN_NOTIFY_WEBHOOK_URL` | ➖ | Discord webhook for new-report notifications in the admin panel |

Add `http://localhost:3000/api/auth/callback/discord` as a redirect URI in your Discord app's OAuth2 settings.

### 3. Set up the database

```bash
pnpm db:push
```

### 4. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm tsc --noEmit` | Typecheck (must pass before pushing) |
| `pnpm test` | Run unit tests (vitest) |
| `pnpm db:generate` | Generate a Drizzle migration |
| `pnpm db:push` | Push schema to the database |
| `pnpm db:studio` | Open Drizzle Studio |

## Project structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── page.tsx            # Public landing page
│   │   ├── gallery/            # Public template gallery (no login)
│   │   ├── t/[slug]/           # Public shared-template view
│   │   ├── docs/               # REST API reference (in-app)
│   │   ├── admin/              # Moderation panel (single account, no public link)
│   │   └── (app)/              # Authenticated app (dashboard, editor, …)
│   └── api/
│       ├── stats/              # Public aggregate stats (cached 5 min)
│       ├── v1/send/            # REST API: send a message via API key
│       └── cron/               # Scheduled jobs (dispatch-scheduled, health-check, cleanup)
├── components/                 # UI: landing, app, editor, templates, …
├── server/actions/             # Server actions (templates, webhooks, logs, …)
├── lib/                        # db, auth, crypto, discord, validations
├── drizzle/                    # SQL migrations (pnpm db:push)
├── scripts/                    # Ops helpers (migrations, admin password hash)
└── messages/                   # i18n strings (en.json, id.json)
```

## API

### REST API v1

Create a key at **Settings → API keys** (`mk_live_...`, shown once — only the SHA-256 hash is stored). Authenticate with `Authorization: Bearer <key>`.

- `POST /api/v1/send` — send via a saved `webhookId` or a `manualUrl`. Supports `idempotencyKey` (max 100 chars; retrying with the same key returns the original result instead of sending twice), `mode`, and `savePayload`. Limited to 5 requests/minute per key. Every API send is recorded in the dashboard logs with `source: "api"`.
- Full reference with examples and error codes: `/docs` (in-app).

### Public

- `GET /api/stats` — platform aggregates (`totalMessages`, `deliveryRate`, `medianLatencyMs`), cached for 5 minutes. Powers the landing page stats strip.

### Cron (protected)

All `/api/cron/*` endpoints require `Authorization: Bearer <CRON_SECRET>`.

- `GET /api/cron/dispatch-scheduled` — sends due scheduled messages. Trigger it every minute from an external cron service (e.g. cron-job.org).
- `GET /api/cron/health-check` — webhook health checks.
- `GET /api/cron/cleanup` — periodic cleanup jobs.

## Admin

A separate single-account moderation panel, independent from Discord OAuth. There is no sign-up and no link to it anywhere in the UI.

### Setup

```bash
node scripts/hash-admin-password.mjs
```

Set the output as `ADMIN_PASSWORD_HASH` (plus `ADMIN_EMAIL`) in your environment, redeploy, then open `/id/admin/login` (or `/en/admin/login`) directly. When the variables are unset, admin login is disabled.

### What it covers

- **Overview** — KPIs, webhook/user/template health, and 30-day activity charts (messages per day, new users per day)
- **Reports** — moderation queue for reported public templates; optional Discord notification per report via `ADMIN_NOTIFY_WEBHOOK_URL`
- **Audit log** — every admin login/logout and moderation action, filterable by category
- **Users** — list, detail view, suspend/unsuspend (blocks login and disables public shares), delete
- **Shared templates** — browse all public shares, revoke or permanently delete abusive ones

Admin pages send `noindex` and are disallowed in `public/robots.txt`.

## Security notes

- Webhook URLs are encrypted at rest (AES) and never exposed to other users.
- API keys are `mk_live_...`; only the SHA-256 hash is stored, the raw key is shown once at creation.
- Share links are unguessable slugs; revoke anytime from the template page.
- Report abusive public templates from the share page.
- Admin auth is a separate HMAC-signed cookie (independent from Discord OAuth), with rate-limited login and no public sign-up.

## Contributing

Issues and pull requests are welcome. Keep it simple: one focused change per PR, `pnpm tsc --noEmit` must pass.

## License

[MIT](LICENSE) — use it, fork it, sell it, just keep the copyright notice.
