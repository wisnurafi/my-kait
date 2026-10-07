import { describe, it, expect } from "vitest";
import { generateSlug, truncate } from "./utils";

describe("generateSlug", () => {
  it("returns 12 lowercase hex chars", () => {
    expect(generateSlug()).toMatch(/^[0-9a-f]{12}$/);
  });

  it("generates unique values", () => {
    const slugs = new Set(Array.from({ length: 100 }, generateSlug));
    expect(slugs.size).toBe(100);
  });
});

describe("truncate", () => {
  it("returns short text unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates long text with an ellipsis", () => {
    expect(truncate("hello world", 6)).toBe("hello…");
  });
});
