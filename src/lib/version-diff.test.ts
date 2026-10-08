import { describe, it, expect } from "vitest";
import { diffVersions, type VersionSnapshot } from "./version-diff";

const base: VersionSnapshot = {
  name: "Promo",
  description: "Desc",
  tags: ["a", "b"],
  folderId: "f1",
  payload: { content: "hello", embeds: [{ title: "T1", description: "D1" }] },
};

const snap = (over: Partial<VersionSnapshot>): VersionSnapshot => ({ ...base, ...over });

describe("diffVersions", () => {
  it("returns no changes for identical snapshots", () => {
    expect(diffVersions(base, snap({}))).toEqual([]);
  });

  it("treats null and empty description as equal", () => {
    expect(diffVersions(snap({ description: null }), snap({ description: "" }))).toEqual([]);
  });

  it("detects name and description changes", () => {
    const changes = diffVersions(base, snap({ name: "Promo 2", description: "New desc" }));
    expect(changes.map((c) => c.field)).toEqual(["name", "description"]);
    expect(changes[0]).toMatchObject({ before: "Promo", after: "Promo 2" });
  });

  it("detects added and removed tags", () => {
    const changes = diffVersions(base, snap({ tags: ["b", "c"] }));
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe("tags");
    expect(changes[0].before).toBe("a, b");
    expect(changes[0].after).toContain("+c");
    expect(changes[0].after).toContain("−a");
  });

  it("ignores tag order", () => {
    expect(diffVersions(base, snap({ tags: ["b", "a"] }))).toEqual([]);
  });

  it("detects folder change with resolved names", () => {
    const resolve = (id: string | null) => (id === "f1" ? "Folder Satu" : id === "f2" ? "Folder Dua" : "Tanpa folder");
    const changes = diffVersions(base, snap({ folderId: "f2" }), resolve);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ field: "folder", before: "Folder Satu", after: "Folder Dua" });
  });

  it("detects nested payload changes with dotted paths", () => {
    const changes = diffVersions(
      base,
      snap({ payload: { content: "hello world", embeds: [{ title: "T1", description: "D2" }] } }),
    );
    const byPath = Object.fromEntries(changes.map((c) => [c.path, c]));
    expect(byPath["content"]).toMatchObject({ before: "hello", after: "hello world" });
    expect(byPath["embeds[0].description"]).toMatchObject({ before: "D1", after: "D2" });
    expect(byPath["embeds[0].title"]).toBeUndefined();
  });

  it("detects added array items and removed keys", () => {
    const changes = diffVersions(
      base,
      snap({ payload: { content: "hello", embeds: [{ title: "T1" }, { title: "T2" }] } }),
    );
    const byPath = Object.fromEntries(changes.map((c) => [c.path, c]));
    // description removed from embeds[0]
    expect(byPath["embeds[0].description"]).toMatchObject({ before: "D1", after: "—" });
    // embeds[1] added
    expect(byPath["embeds[1]"].after).toContain("T2");
  });

  it("detects payload type changes", () => {
    const changes = diffVersions(base, snap({ payload: { content: ["not", "a", "string"] } }));
    expect(changes.some((c) => c.path === "content")).toBe(true);
  });

  it("renders empty values as em-dash", () => {
    const changes = diffVersions(base, snap({ description: null, payload: { content: "" } }));
    const desc = changes.find((c) => c.field === "description");
    expect(desc).toMatchObject({ before: "Desc", after: "—" });
  });
});
