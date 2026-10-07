import { describe, it, expect } from "vitest";
import {
  extractCustomVariables,
  substituteVariables,
  substitutePayloadVariables,
  parseCustomVars,
} from "./template-vars";

describe("extractCustomVariables", () => {
  it("finds custom tokens and ignores built-ins", () => {
    expect(
      extractCustomVariables("Halo {nama}, hari ini {tanggal} jam {waktu}"),
    ).toEqual(["{nama}"]);
  });

  it("dedupes and preserves order of first appearance", () => {
    expect(extractCustomVariables("{b} {a} {b} {a}")).toEqual(["{b}", "{a}"]);
  });

  it("returns empty array when there are no tokens", () => {
    expect(extractCustomVariables("plain text")).toEqual([]);
  });

  it("ignores malformed braces", () => {
    expect(extractCustomVariables("{unclosed and {} empty")).toEqual([]);
  });
});

describe("substituteVariables", () => {
  it("replaces custom variables", () => {
    expect(
      substituteVariables("Halo {nama}!", { "{nama}": "Wisnu" }),
    ).toBe("Halo Wisnu!");
  });

  it("leaves unknown tokens untouched", () => {
    expect(substituteVariables("Halo {unknown}!", {})).toBe("Halo {unknown}!");
  });

  it("custom vars override built-in defaults", () => {
    expect(
      substituteVariables("{tahun}", { "{tahun}": "2099" }),
    ).toBe("2099");
  });

  it("substitutes built-in {tahun} with the current year", () => {
    expect(substituteVariables("{tahun}")).toBe(String(new Date().getFullYear()));
  });
});

describe("substitutePayloadVariables", () => {
  it("recurses through nested objects and arrays", () => {
    const out = substitutePayloadVariables(
      {
        content: "Hi {nama}",
        embeds: [{ title: "{nama}", fields: [{ value: "{x}" }] }],
        count: 3,
        flag: true,
        nothing: null,
      },
      { "{nama}": "Wisnu", "{x}": "y" },
    );
    expect(out).toEqual({
      content: "Hi Wisnu",
      embeds: [{ title: "Wisnu", fields: [{ value: "y" }] }],
      count: 3,
      flag: true,
      nothing: null,
    });
  });

  it("leaves non-string values untouched", () => {
    const payload = { n: 42, b: false };
    expect(substitutePayloadVariables(payload, {})).toEqual(payload);
  });
});

describe("parseCustomVars", () => {
  it("accepts a valid JSON string of {token} -> value pairs", () => {
    expect(parseCustomVars('{"{nama}":"Budi","{kota}":"Jakarta"}')).toEqual({
      "{nama}": "Budi",
      "{kota}": "Jakarta",
    });
  });

  it("accepts an already-parsed object (scheduled action path)", () => {
    expect(parseCustomVars({ "{nama}": "Budi" })).toEqual({ "{nama}": "Budi" });
  });

  it("returns undefined for empty/missing input", () => {
    expect(parseCustomVars("")).toBeUndefined();
    expect(parseCustomVars(undefined)).toBeUndefined();
    expect(parseCustomVars(null)).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    expect(parseCustomVars("{not json")).toBeUndefined();
  });

  it("returns undefined for non-object JSON", () => {
    expect(parseCustomVars("[1,2]")).toBeUndefined();
    expect(parseCustomVars('"str"')).toBeUndefined();
    expect(parseCustomVars("123")).toBeUndefined();
  });

  // SECURITY: replaceAll("", X) splices X between every character — the
  // empty-key case must never reach substitutePayloadVariables.
  it("rejects an empty key (OOM vector)", () => {
    expect(parseCustomVars({ "": "x".repeat(100) })).toBeUndefined();
    expect(parseCustomVars('{"":"x"}')).toBeUndefined();
  });

  it("rejects keys without braces", () => {
    expect(parseCustomVars({ nama: "Budi" })).toBeUndefined();
  });

  it("rejects keys longer than 60 chars", () => {
    expect(parseCustomVars({ [`{${"a".repeat(60)}}`]: "x" })).toBeUndefined();
  });

  it("rejects values longer than 500 chars", () => {
    expect(parseCustomVars({ "{nama}": "x".repeat(501) })).toBeUndefined();
  });

  it("rejects non-string values", () => {
    expect(parseCustomVars({ "{nama}": 123 })).toBeUndefined();
  });

  it("rejects more than 20 entries", () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 21; i++) big[`{v${i}}`] = "x";
    expect(parseCustomVars(big)).toBeUndefined();
  });

  it("rejects an empty object", () => {
    expect(parseCustomVars({})).toBeUndefined();
  });
});
