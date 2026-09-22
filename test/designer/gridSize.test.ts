import { describe, expect, it } from "vitest";
import { computeSpawnPosition } from "../../src/designer/helpers";
import { pastePosition } from "../../src/designer/useClipboardAndDelete";
import { nextFreeY } from "../../src/schemaFactory";
import { GRID_SIZE_MM } from "../../src/page/units";
import type { Schema, Template } from "../../src/types";

// `gridSizeMm` was honored by ONE path only (PageCanvas's drag/resize, which
// already received the prop). A field's birth and pasting used the GRID_SIZE_MM
// constant directly, so a consumer with `gridSizeMm={2}` had fields being born
// and pasted off their own grid — misaligned, with no way to "snap" them other
// than dragging by hand.
//
// All three paths now receive the step. Each test below has a pair (default vs
// custom) because the failure mode is precisely "the parameter arrived but was
// ignored": only the custom case tells them apart.

const A4: Template["page"] = { width: 210, height: 297 };

function box(over: Partial<Schema> = {}): Schema {
  return { id: "s1", name: "campo", type: "text", x: 0, y: 0, width: 40, height: 10, content: "x", ...over } as Schema;
}

describe("nextFreeY honra o passo da grade", () => {
  it("sem passo, alinha em 5mm (GRID_SIZE_MM)", () => {
    // maior y+height = 33, +5 = 38 → 40 no grid de 5
    expect(nextFreeY([box({ y: 23, height: 10 })])).toBe(40);
    expect(GRID_SIZE_MM).toBe(5);
  });

  it("com passo 2, alinha em 2mm", () => {
    // 38 is already a multiple of 2, so the value DIFFERS from the case above
    // — that is what proves the parameter was used and not swallowed.
    expect(nextFreeY([box({ y: 23, height: 10 })], 2)).toBe(38);
  });

  it("canvas vazio não depende do passo", () => {
    expect(nextFreeY([], 2)).toBe(10);
    expect(nextFreeY([])).toBe(10);
  });
});

describe("computeSpawnPosition honra o passo da grade", () => {
  const template = { page: A4, schemas: [], headerHeight: 13, footerHeight: 0, marginLeft: 0, marginRight: 0 } as unknown as Template;

  it("sem passo, x/y caem em múltiplo de 5", () => {
    const placed = computeSpawnPosition(template, box({ width: 41, height: 11 }), false);
    expect(placed.x % 5).toBe(0);
    expect(placed.y % 5).toBe(0);
  });

  it("com passo 2, x/y caem em múltiplo de 2 e mudam de valor", () => {
    const cinco = computeSpawnPosition(template, box({ width: 41, height: 11 }), false);
    const dois = computeSpawnPosition(template, box({ width: 41, height: 11 }), false, 2);
    expect(dois.x % 2).toBe(0);
    expect(dois.y % 2).toBe(0);
    // If the parameter were ignored, the two would be identical.
    expect([dois.x, dois.y]).not.toEqual([cinco.x, cinco.y]);
  });
});

describe("pastePosition", () => {
  it("desloca um passo e alinha na grade", () => {
    expect(pastePosition(box({ x: 10, y: 20 }), A4, 5)).toEqual({ x: 15, y: 25 });
    expect(pastePosition(box({ x: 10, y: 20 }), A4, 2)).toEqual({ x: 12, y: 22 });
  });

  it("posição fora da grade é atraída pra ela, não só somada", () => {
    // x=11 with a step of 5: 11+5=16 → snaps to 15. The pasted field ENTERS
    // the grid, which is the point (pasting without aligning left the original
    // misaligned forever).
    expect(pastePosition(box({ x: 11, y: 11 }), A4, 5)).toEqual({ x: 15, y: 15 });
  });

  it("trava dentro da página, arredondando o limite pra BAIXO", () => {
    // width 40 on a 210 page → maxX = floor(170/5)*5 = 170.
    expect(pastePosition(box({ x: 205, y: 0, width: 40 }), A4, 5).x).toBe(170);
    // With a step of 3: floor(170/3)*3 = 168, and not 170 — the limit honors
    // the grid too, otherwise a field clamped at the edge ended up off it.
    expect(pastePosition(box({ x: 205, y: 0, width: 40 }), A4, 3).x).toBe(168);
  });

  it("campo maior que a página cola em 0, não em negativo", () => {
    expect(pastePosition(box({ x: 0, y: 0, width: 400, height: 400 }), A4, 5)).toEqual({ x: 0, y: 0 });
  });
});
