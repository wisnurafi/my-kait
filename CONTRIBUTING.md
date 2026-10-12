# Contributing to My-Kait

Thanks for your interest in contributing! This guide covers local setup, project conventions, and what we look for in pull requests.

## Ways to contribute

- Bug fixes and reliability improvements
- New features or enhancements to existing ones
- Documentation updates

Before starting a large feature, open an issue so we can align on scope and avoid duplicate work.

## Getting started

### Prerequisites

- **Node.js 20+**
- **[pnpm](https://pnpm.io) 12+**
- A **PostgreSQL** database ([Neon](https://neon.tech) works out of the box)
- A **Discord application** for OAuth (for login and share testing)

### Local setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Copy the environment file and configure it:
   ```bash
   cp .env.example .env.local
   ```
   Every variable is documented in `.env.example`. At minimum you need
   `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, `AUTH_SECRET`, `AUTH_URL`
   (`http://localhost:3000`), `DATABASE_URL`, and `WEBHOOK_ENCRYPTION_KEY`.
   Add `http://localhost:3000/api/auth/callback/discord` as a redirect URI in your
   Discord app's OAuth2 settings.
4. Set up the database:
   ```bash
   pnpm db:push
   ```
5. Run the dev server:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000).
6. Run the checks (typecheck **must** pass before pushing):
   ```bash
   pnpm tsc --noEmit
   pnpm test
   ```

### Admin panel (optional)

Generate a password hash, set it as `ADMIN_PASSWORD_HASH` (plus `ADMIN_EMAIL`),
restart, then open `/id/admin/login` (or `/en/admin/login`) directly. There is no
link to it anywhere in the UI, and login stays disabled while the variables are unset.

```bash
node scripts/hash-admin-password.mjs
```

## Project conventions

One branch per feature, so every change gets a Vercel preview deployment to test
before merge. The maintainer merges PRs himself — don't merge your own.

Branch names: `fix/<...>` · `feat/<...>` · `chore/<...>` · `docs/<...>`

Commit messages are short and Indonesian, with a lowercase prefix, for example:
`fix: akurasi kontrak API v1/send`, `docs: README selaras dengan fitur terkini`.

Things to know before you touch the code:

- **App Router layout**: `src/app/[locale]/` holds the localized pages (landing, gallery, share page, docs, admin, and the authenticated app under `(app)/`); `src/app/api/` holds routes for stats, `v1/send`, and protected cron jobs. UI lives in `src/components/`, server actions in `src/server/actions/`, shared logic in `src/lib/`, migrations in `src/drizzle/`. See `roadmap.txt` for the full map.
- **Schema changes need migration first**: if your PR changes `src/lib/schema.ts`, run `pnpm db:push` against production **before** the PR is merged — Vercel auto-deploys right after merge, and an undeployed column breaks every insert until the migration runs.
- **`"use server"` files can only export async functions** (Next build rule, not a TS rule — `tsc` will not catch violations). Shared constants go in a plain lib file or the consuming component, never in a server-actions file.
- **Server actions need explicit return types** like `Promise<{ error: string } | { success: true }>` so the `"error" in res` narrowing works on the client. Without it, `res.error` infers as `string | undefined`.
- **Typecheck is the gate**: `pnpm tsc --noEmit` must pass. `pnpm dev`/`pnpm build` can fail in some container environments; treat the typecheck as the source of truth.
- **Bilingual is a hard requirement** (`id` default, `en`): every user-facing string goes into both `src/messages/id.json` and `src/messages/en.json`. Leftover untranslated strings after a locale switch are a major bug — audit and fix everything affected, not just the spot you touched.
- **Copy voice**: first-person indie-dev, concrete and honest — never generic AI phrasing like "Kami menyimpan…" / "You can…". Keep ID and EN versions consistent in tone.
- **Share page (`/t/[slug]`)**: no language/theme toggles of its own — theme follows the shared `mykait-landing-theme` key, locale follows the share URL. Don't add UI chrome back to it.
- **Admin panel**: single account, no sign-up, noindex, not linked in the UI — keep it that way. Every admin action should be logged to the audit log.
- **Rate limiting**: new public or unauthenticated endpoints must be rate-limited via Upstash. Production refuses to boot without Upstash credentials — never "fix" that guard by making it optional.
- **Secrets stay out of the repo**: webhook URLs are encrypted at rest (AES), API keys store only the SHA-256 hash, share slugs must stay unguessable. Never commit `.env.local`.
- **Tests** live next to the code as `*.test.ts` (vitest, `pnpm test`). Add or update tests for pure logic (crypto, validations, template variables, version diff).

## Code guidelines

- Match existing style — look at the neighboring feature first.
- Validate inputs with zod on the server, including update paths (don't only validate creates).
- Handle errors gracefully: catch failures, log with context (`src/lib/logger.ts`), and return user-friendly messages.
- Keep changes minimal — extend existing utilities instead of duplicating logic.
- Document user-facing behavior: update README.md when setup steps or config change, and mention new env vars in `.env.example`.

## Pull request checklist

In your PR description, include:

- **What** changed
- **Why** it's needed
- **How to test** it manually (pages to open, env vars to set, the Vercel preview link)

Confirm `pnpm tsc --noEmit` passes, and mention any schema change so the migration can be pushed before merge.

## Reporting issues

When reporting a bug, include:

- Steps to reproduce
- Expected vs. actual behavior
- Which locale (`id` / `en`) and route
- Relevant logs (`LOG_LEVEL=debug` helps locally)
- Commit hash if known

## License

By contributing, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers this project.
