/**
 * version-diff — pure helpers to compare a template version snapshot against
 * the template's current state, for the history diff preview.
 * Plain lib file (not "use server") so it can export anything and be unit-tested.
 */

export interface VersionSnapshot {
  name: string;
  description: string | null;
  tags: string[] | null;
  folderId: string | null;
  payload: unknown;
}

export interface FieldChange {
  /** Field key: "name" | "description" | "tags" | "folder" | "payload". */
  field: string;
  /** Dotted path inside the payload for payload changes, e.g. "embeds[0].title". */
  path?: string;
  before: string;
  after: string;
}

const MAX_VALUE_LEN = 120;
const MAX_PAYLOAD_CHANGES = 30;

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "—";
    return s.length > MAX_VALUE_LEN ? s.slice(0, MAX_VALUE_LEN) + "…" : s;
  }
  try {
    const s = JSON.stringify(v) ?? String(v);
    return s.length > MAX_VALUE_LEN ? s.slice(0, MAX_VALUE_LEN) + "…" : s;
  } catch {
    return String(v);
  }
}

function diffValues(
  before: unknown,
  after: unknown,
  path: string,
  out: FieldChange[],
): void {
  if (out.length >= MAX_PAYLOAD_CHANGES) return;
  if (Object.is(before, after)) return;

  const bIsObj = before !== null && typeof before === "object";
  const aIsObj = after !== null && typeof after === "object";

  if (bIsObj && aIsObj) {
    if (Array.isArray(before) && Array.isArray(after)) {
      const n = Math.max(before.length, after.length);
      for (let i = 0; i < n; i++) {
        diffValues(before[i], after[i], `${path}[${i}]`, out);
      }
      return;
    }
    if (!Array.isArray(before) && !Array.isArray(after)) {
      const b = before as Record<string, unknown>;
      const a = after as Record<string, unknown>;
      for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
        diffValues(b[k], a[k], path ? `${path}.${k}` : k, out);
      }
      return;
    }
  }

  // Primitive change, added/removed key, or object<->primitive type change.
  out.push({ field: "payload", path: path || "(root)", before: fmt(before), after: fmt(after) });
}

/**
 * Diff a version snapshot against the template's current state.
 * Direction: before = current, after = version (what a restore would apply).
 */
export function diffVersions(
  current: VersionSnapshot,
  version: VersionSnapshot,
  resolveFolder?: (id: string | null) => string,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const folderName = resolveFolder ?? ((id) => id ?? "—");

  if (current.name !== version.name) {
    changes.push({ field: "name", before: fmt(current.name), after: fmt(version.name) });
  }

  if ((current.description ?? "") !== (version.description ?? "")) {
    changes.push({
      field: "description",
      before: fmt(current.description),
      after: fmt(version.description),
    });
  }

  const curTags = [...(current.tags ?? [])].sort();
  const verTags = [...(version.tags ?? [])].sort();
  if (JSON.stringify(curTags) !== JSON.stringify(verTags)) {
    const added = verTags.filter((x) => !curTags.includes(x));
    const removed = curTags.filter((x) => !verTags.includes(x));
    const parts: string[] = [];
    if (added.length) parts.push(added.map((x) => `+${x}`).join(" "));
    if (removed.length) parts.push(removed.map((x) => `−${x}`).join(" "));
    changes.push({
      field: "tags",
      before: curTags.join(", ") || "—",
      after: parts.join(" ") || "—",
    });
  }

  if (current.folderId !== version.folderId) {
    changes.push({
      field: "folder",
      before: folderName(current.folderId),
      after: folderName(version.folderId),
    });
  }

  diffValues(current.payload, version.payload, "", changes);

  return changes;
}
