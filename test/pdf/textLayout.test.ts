import { describe, expect, it } from "vitest";
import type { PDFFont } from "pdf-lib";
import { alignX, alignY, truncateToWidth } from "../../src/pdf/textLayout";

describe("alignX", () => {
  const boxWidth = 100;
  const paddingPt = 4;

  it("left: returns paddingPt regardless of textWidth", () => {
    expect(alignX("left", boxWidth, 30, paddingPt)).toBe(paddingPt);
    expect(alignX("left", boxWidth, boxWidth, paddingPt)).toBe(paddingPt);
  });

  it("center: centers when textWidth is smaller than boxWidth", () => {
    expect(alignX("center", boxWidth, 30, paddingPt)).toBe(35); // (100-30)/2
  });

  it("center: offset is 0 when textWidth equals boxWidth", () => {
    expect(alignX("center", boxWidth, boxWidth, paddingPt)).toBe(0);
  });

  it("right: pads from the right edge when textWidth is smaller than boxWidth", () => {
    expect(alignX("right", boxWidth, 30, paddingPt)).toBe(66); // 100-30-4
  });

  it("right: clamps to 0 when textWidth (plus padding) exceeds boxWidth", () => {
    expect(alignX("right", boxWidth, boxWidth, paddingPt)).toBe(0);
  });
});

describe("alignY", () => {
  const boxHeight = 20;
  const fontSizePt = 9;
  const paddingPt = 3;

  it("top: boxHeight - paddingPt - fontSizePt", () => {
    expect(alignY("top", boxHeight, fontSizePt, paddingPt)).toBe(8); // 20-3-9
  });

  it("bottom: paddingPt", () => {
    expect(alignY("bottom", boxHeight, fontSizePt, paddingPt)).toBe(paddingPt);
  });

  it("middle: boxHeight/2 - fontSizePt/2.8", () => {
    expect(alignY("middle", boxHeight, fontSizePt, paddingPt)).toBeCloseTo(10 - 9 / 2.8);
  });
});

describe("truncateToWidth", () => {
  // widthOfTextAtSize proporcional ao comprimento (NÃO constante), pra
  // truncamento de verdade ser exercitado — cada caractere "pesa" 5.
  const fakeFont = { widthOfTextAtSize: (text: string) => text.length * 5 } as unknown as PDFFont;

  it("returns the text unchanged when it already fits maxWidth", () => {
    // "hello" = 5 chars * 5 = 25 <= 30
    expect(truncateToWidth("hello", fakeFont, 1, 30)).toBe("hello");
  });

  it("returns the text unchanged when it fits exactly", () => {
    // "hi" = 2 chars * 5 = 10 <= 10
    expect(truncateToWidth("hi", fakeFont, 1, 10)).toBe("hi");
  });

  it("shortens text that doesn't fit and appends an ellipsis", () => {
    // "hello world" = 11 chars * 5 = 55 > 20.
    const result = truncateToWidth("hello world", fakeFont, 1, 20);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toBe("hello world");
    // "hell…" = 5 chars * 5 = 25 > 20, "hel…" = 4*5=20 <= 20.
    expect(result).toBe("hel…");
  });

  it("terminates without an infinite loop when maxWidth is too small for even 1 char + ellipsis", () => {
    const result = truncateToWidth("hello world", fakeFont, 1, 1);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toBe("h…");
  });
});
