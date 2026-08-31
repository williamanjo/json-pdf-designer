import { describe, expect, it } from "vitest";
import { roundedRectPath } from "../../src/pdf/svgShapes";

describe("roundedRectPath", () => {
  it("single-number radius matches the equivalent {tl,tr,bl,br} all-equal object", () => {
    const byNumber = roundedRectPath(20, 12, 3);
    const byObject = roundedRectPath(20, 12, { tl: 3, tr: 3, bl: 3, br: 3 });
    expect(byNumber).toBe(byObject);
  });

  it("produces the exact expected path for width=10, height=10, radius=3", () => {
    // Cálculo manual pelo algoritmo: half = min(10,10)/2 = 5;
    // tl=tr=bl=br = clamp(3, 0, 5) = 3.
    const expected = "M 3,0 H 7 A 3,3 0 0 1 10,3 V 7 A 3,3 0 0 1 7,10 H 3 A 3,3 0 0 1 0,7 V 3 A 3,3 0 0 1 3,0 Z";
    expect(roundedRectPath(10, 10, 3)).toBe(expected);
  });

  it("supports independent per-corner values", () => {
    // width=20, height=10 -> half = min(20,10)/2 = 5.
    // tl=1, tr=2, bl=3, br=4 (todos <= 5, sem clamp).
    const path = roundedRectPath(20, 10, { tl: 1, tr: 2, bl: 3, br: 4 });
    const expected = "M 1,0 H 18 A 2,2 0 0 1 20,2 V 6 A 4,4 0 0 1 16,10 H 3 A 3,3 0 0 1 0,7 V 1 A 1,1 0 0 1 1,0 Z";
    expect(path).toBe(expected);
  });

  it("clamps a radius larger than half of the smaller dimension", () => {
    // width=10, height=6 -> half = min(10,6)/2 = 3. radius=8 -> clamp to 3,
    // igual em todo canto (via número único).
    const clamped = roundedRectPath(10, 6, 8);
    const atHalf = roundedRectPath(10, 6, 3);
    expect(clamped).toBe(atHalf);
  });

  it("clamps each corner independently in the object form", () => {
    // width=10, height=6 -> half = 3. tl=8 (clampa pra 3), tr=1 (sem clamp).
    const path = roundedRectPath(10, 6, { tl: 8, tr: 1, bl: 0, br: 0 });
    const expected = "M 3,0 H 9 A 1,1 0 0 1 10,1 V 6 A 0,0 0 0 1 10,6 H 0 A 0,0 0 0 1 0,6 V 3 A 3,3 0 0 1 3,0 Z";
    expect(path).toBe(expected);
  });
});
