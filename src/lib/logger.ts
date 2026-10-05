/**
 * Tiny structured logger.
 *
 * All production logging goes through here so Vercel logs stay greppable:
 * every line carries a `[scope]` prefix and the log level is explicit.
 * Keep it dependency-free — this module is imported by server actions,
 * route handlers, and client components alike.
 */

function formatDetail(detail: unknown): unknown[] {
  if (detail === undefined) return [];
  if (detail instanceof Error) return [detail.message, detail.stack].filter(Boolean);
  return [detail];
}

function write(
  level: "info" | "warn" | "error",
  scope: string,
  message: string,
  detail?: unknown,
): void {
  const line = `[${scope}] ${message}`;
  const extra = formatDetail(detail);
  if (level === "error") console.error(line, ...extra);
  else if (level === "warn") console.warn(line, ...extra);
  else console.info(line, ...extra);
}

export const logger = {
  info: (scope: string, message: string, detail?: unknown) =>
    write("info", scope, message, detail),
  warn: (scope: string, message: string, detail?: unknown) =>
    write("warn", scope, message, detail),
  error: (scope: string, message: string, detail?: unknown) =>
    write("error", scope, message, detail),
};
