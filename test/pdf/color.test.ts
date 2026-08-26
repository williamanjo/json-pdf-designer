import { describe, expect, it } from "vitest";
import { parseHex } from "../../src/pdf/color";

describe("parseHex", () => {
  it("parses a 6-digit hex with #", () => {
    expect(parseHex("#ff0000")).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("parses a 6-digit hex without #", () => {
    expect(parseHex("00ff00")).toEqual({ r: 0, g: 1, b: 0 });
  });

  it("expands a 3-digit shorthand hex", () => {
    expect(parseHex("#00f")).toEqual({ r: 0, g: 0, b: 1 });
  });

  it("returns undefined for undefined/empty input", () => {
    expect(parseHex(undefined)).toBeUndefined();
    expect(parseHex("")).toBeUndefined();
  });

  it("returns undefined for wrong-length or non-hex input", () => {
    expect(parseHex("#1234")).toBeUndefined();
    expect(parseHex("#zzzzzz")).toBeUndefined();
  });
});
