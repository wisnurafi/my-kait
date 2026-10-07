/**
 * Template variable substitution.
 * See PRD section 3.10 (P2).
 *
 * Supported variables:
 * {tanggal}      — current date (ID format)
 * {tanggal_en}   — current date (EN format)
 * {waktu}        — current time
 * {timestamp}    — ISO timestamp
 * {tanggal_lengkap} — full date+time
 * {hari}         — day name (ID)
 * {bulan}        — month name (ID)
 * {tahun}        — year
 */

const dayNamesID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const monthNamesID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const dayNamesEN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const monthNamesEN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Built-in variable names. Anything matching {…} that is NOT in this list
 * is treated as a user-defined custom variable.
 */
export const BUILTIN_VARIABLE_NAMES = [
  "{tanggal}",
  "{tanggal_en}",
  "{waktu}",
  "{timestamp}",
  "{tanggal_lengkap}",
  "{hari}",
  "{hari_en}",
  "{bulan}",
  "{bulan_en}",
  "{tahun}",
] as const;

const BUILTIN_SET = new Set<string>(BUILTIN_VARIABLE_NAMES);

/**
 * Extract custom (user-defined) variable tokens from text.
 * Finds all {…} tokens and filters out the built-in ones.
 * Returns unique tokens in order of first appearance.
 */
export function extractCustomVariables(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const re = /\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = m[0];
    if (!BUILTIN_SET.has(token) && !seen.has(token)) {
      seen.add(token);
      found.push(token);
    }
  }
  return found;
}

export function substituteVariables(text: string, customVars?: Record<string, string>): string {
  const now = new Date();
  
  const defaults: Record<string, string> = {
    "{tanggal}": now.toLocaleDateString("id-ID"),
    "{tanggal_en}": now.toLocaleDateString("en-US"),
    "{waktu}": now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    "{timestamp}": now.toISOString(),
    "{tanggal_lengkap}": now.toLocaleString("id-ID"),
    "{hari}": dayNamesID[now.getDay()],
    "{hari_en}": dayNamesEN[now.getDay()],
    "{bulan}": monthNamesID[now.getMonth()],
    "{bulan_en}": monthNamesEN[now.getMonth()],
    "{tahun}": String(now.getFullYear()),
  };

  // Merge custom vars over defaults
  const vars = { ...defaults, ...customVars };

  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

/**
 * Recursively substitute variables in a payload object.
 * Traverses all string values in the payload.
 */
export function substitutePayloadVariables(
  payload: Record<string, unknown>,
  customVars?: Record<string, string>,
): Record<string, unknown> {
  function processValue(value: unknown): unknown {
    if (typeof value === "string") {
      return substituteVariables(value, customVars);
    }
    if (Array.isArray(value)) {
      return value.map(processValue);
    }
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = processValue(v);
      }
      return result;
    }
    return value;
  }

  return processValue(payload) as Record<string, unknown>;
}

/**
 * Validate user-supplied custom template variables.
 *
 * Accepts a JSON string (e.g. from FormData) or an already-parsed value.
 * Returns the validated record, or undefined when the input is missing,
 * malformed, or fails validation — callers treat invalid input as
 * "no custom vars", never an error (same as the send form always did).
 *
 * Rules:
 * - plain object (not array), 1–20 entries
 * - key matches /^\{[^{}]+\}$/ (e.g. "{nama}"), max 60 chars
 * - value is a string, max 500 chars
 *
 * The key shape + value cap close the replaceAll("", X) memory-exhaustion
 * vector: an empty key would splice X between every character of the payload.
 */
export function parseCustomVars(
  input: unknown,
): Record<string, string> | undefined {
  let parsed: unknown = input;
  if (typeof input === "string") {
    if (!input) return undefined;
    try {
      parsed = JSON.parse(input);
    } catch {
      return undefined;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  const valid =
    entries.length > 0 &&
    entries.length <= 20 &&
    entries.every(
      ([k, v]) =>
        typeof v === "string" &&
        v.length <= 500 &&
        /^\{[^{}]+\}$/.test(k) &&
        k.length <= 60,
    );
  if (!valid) return undefined;
  return Object.fromEntries(entries.map(([k, v]) => [k, v as string]));
}
