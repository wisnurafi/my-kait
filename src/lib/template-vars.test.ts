import { describe, it, expect } from "vitest";
import {
  extractCustomVariables,
  substituteVariables,
  substitutePayloadVariables,
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
