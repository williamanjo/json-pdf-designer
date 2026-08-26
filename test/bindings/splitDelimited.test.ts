import { describe, expect, it } from "vitest";
import { splitDelimited } from "../../src/bindings/splitDelimited";

describe("splitDelimited", () => {
  it("splits a plain comma list", () => {
    expect(splitDelimited("a, b, c")).toEqual(["a", "b", "c"]);
  });

  it("keeps a comma inside quotes intact", () => {
    expect(splitDelimited('total, "R$", 2')).toEqual(["total", '"R$"', "2"]);
    expect(splitDelimited('a, ", ", b')).toEqual(["a", '", "', "b"]);
  });

  it("keeps a comma inside nested parens intact", () => {
    expect(splitDelimited("SUM(rows.total), 2")).toEqual(["SUM(rows.total)", "2"]);
    expect(splitDelimited("CONCAT(a, b), c")).toEqual(["CONCAT(a, b)", "c"]);
  });

  it("respects both quotes and parens at once", () => {
    expect(splitDelimited('SUM(rows.total), "R$", 2')).toEqual(["SUM(rows.total)", '"R$"', "2"]);
  });

  it("returns empty array for empty/blank input", () => {
    expect(splitDelimited("")).toEqual([]);
    expect(splitDelimited("   ")).toEqual([]);
  });

  it("returns a single item for input without commas", () => {
    expect(splitDelimited("rows.total_amount")).toEqual(["rows.total_amount"]);
  });

  it("trims whitespace around each part", () => {
    expect(splitDelimited("  a  ,  b  ")).toEqual(["a", "b"]);
  });
});
