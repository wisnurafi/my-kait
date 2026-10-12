# Security Policy — My-Kait

We take security seriously. If you discover a vulnerability, please follow the policy below so we can triage and address it safely.

## Summary / self-hosting clarity

My-Kait is distributed as open-source software (MIT) for self-hosting. The maintainers do not operate self-hosted instances and do not have access to user data, webhook URLs, API keys, or configurations on third-party deployments. Self-hosters are responsible for securing and operating their own instances. This policy describes how to report vulnerabilities affecting the project code, plus guidance for self-hosters who discover security issues in their own deployment.

## Reporting a vulnerability

- **Preferred:** open a private GitHub Security Advisory for this repository.
- Do NOT open a public issue with exploit details.

If you found a problem in your self-hosted instance that looks like misconfiguration, check your own setup first. If you believe the issue is caused by a vulnerability in My-Kait's code, report it as above and mention whether it was observed on a self-hosted deployment.

## Response timelines (what to expect)

- Acknowledgement: within 72 hours.
- Triage & severity estimate: within 7 days.
- Fix plan:
  - Critical: aim to ship a fix or mitigation within 7–14 days.
  - High: aim to ship within 30 days.
  - Medium/Low: addressed in a future release; communicated within 90 days.
- Public disclosure: coordinated with the reporter, normally published after a patch is released (or within 90 days if unresolved, unless the reporter requests otherwise).

## Safe testing rules

- Only test deployments you own or have explicit permission to test.
- Do not access, exfiltrate, or modify other users' templates, webhooks, messages, or accounts.
- Do not attempt to read webhook URLs, API keys, session cookies, or OAuth tokens that don't belong to you.
- Provide a minimal, safe proof-of-concept that reproduces the issue. Redact tokens and PII.
- If the vulnerability needs intrusive testing (e.g. auth bypass on a live instance), contact us first to agree on a plan.

## What to include in your report

- Component affected (e.g., `/api/v1/send` handler, admin login, server action, template-share route).
- Clear, minimal steps to reproduce (HTTP method, endpoint, request body where relevant).
- Environment: commit SHA or deployment source.
- Authentication context (unauthenticated, logged-in user, admin, API key).
- Proof-of-concept (script, requests, logs, screenshots) — sanitize secrets first.
- Impact (data exposure, privilege escalation, stored webhook leak, etc.).
- Suggested mitigation (if any).
- Contact info for follow-up.

## If your self-hosted instance is compromised

- Immediately rotate exposed secrets (`DISCORD_CLIENT_SECRET`, `AUTH_SECRET`, `WEBHOOK_ENCRYPTION_KEY`, `DATABASE_URL`, `UPSTASH_REDIS_REST_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `ADMIN_PASSWORD_HASH`).
- Snapshot logs/configuration for investigation (never share secrets).
- If you need upstream help, file a private security advisory with sanitized reproduction steps and the commit SHA you're running.
- Maintainers can only fix vulnerabilities in upstream code — we can't rotate your tokens or remediate your deployment.

Note: webhook URLs are encrypted at rest. If `WEBHOOK_ENCRYPTION_KEY` was exposed, treat all stored webhooks as compromised and rotate the Discord webhooks themselves too — rotating the key alone re-encrypts future values.

## Scope

- In-scope: this repository's code, including the Discord OAuth and admin login flows, REST API authentication and rate limiting, webhook URL encryption, template share-link access control, cron endpoint protection, and user data handling.
- Out-of-scope:
  - Third-party services (Discord, Neon, Upstash, Vercel, Vercel Blob) — report to them directly.
  - Vulnerabilities in third-party dependencies — report upstream first; a My-Kait advisory is appropriate only if the dependency can't be fixed by upgrading.
  - Your own deployment's misconfiguration, unless you can show it's caused by a bug in this code.

## Hardening advice for self-hosters

- Keep secrets out of the repository — use `.env.local` (see `.env.example`), your host's env UI, or a secret manager. Never commit `.env.local`. It is gitignored for a reason.
- Rate limiting is **required in production**: the app refuses to boot without Upstash credentials (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Don't deploy a public instance with rate limiting disabled.
- `/api/cron/*` endpoints are protected by `CRON_SECRET` — set it, and configure your external cron (e.g. cron-job.org) to send `Authorization: Bearer <secret>`. The app refuses to boot in production without it.
- Admin login is disabled when `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` are unset. Keep it that way unless you need the panel; the login page has no public link but obscurity is not security.
- Use the **pooled** Neon connection string for `DATABASE_URL`.
- Enable Dependabot / security alerts and secret scanning on your fork.
- Rotate webhook encryption keys and re-auth users if you suspect compromise.
- Watch the logs — background jobs (scheduled dispatch, webhook health checks) log an info-level heartbeat so a silent job reads as alive, not dead.

## Privacy & telemetry

My-Kait does not phone home or collect usage data. Maintainers receive nothing from self-hosted instances.

## Disclosure & credits

Researchers are credited in release notes/advisories unless anonymity is requested.

Thank you for helping keep My-Kait safe.
