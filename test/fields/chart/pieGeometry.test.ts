import { describe, expect, it } from "vitest";
import { pieSlicePath, pointOnCircle } from "../../../src/fields/chart/pieGeometry";

describe("pointOnCircle", () => {
  // Ângulo medido a partir do topo (12h), sentido horário, y cresce pra baixo.
  const cx = 10;
  const cy = 20;
  const r = 5;

  it("0° fica no topo do círculo (x = cx, y = cy - r)", () => {
    const p = pointOnCircle(cx, cy, r, 0);
    expect(p.x).toBeCloseTo(cx, 10);
    expect(p.y).toBeCloseTo(cy - r, 10);
  });

  it("90° fica à direita do círculo (x = cx + r, y = cy)", () => {
    const p = pointOnCircle(cx, cy, r, 90);
    expect(p.x).toBeCloseTo(cx + r, 10);
    expect(p.y).toBeCloseTo(cy, 10);
  });

  it("180° fica embaixo do círculo (x = cx, y = cy + r)", () => {
    const p = pointOnCircle(cx, cy, r, 180);
    expect(p.x).toBeCloseTo(cx, 10);
    expect(p.y).toBeCloseTo(cy + r, 10);
  });

  it("270° fica à esquerda do círculo (x = cx - r, y = cy)", () => {
    const p = pointOnCircle(cx, cy, r, 270);
    expect(p.x).toBeCloseTo(cx - r, 10);
    expect(p.y).toBeCloseTo(cy, 10);
  });
});

describe("pieSlicePath", () => {
  const cx = 0;
  const cy = 0;
  const outerR = 10;

  it("fatia de pizza cheia (innerR <= 0) de 0° a 90° usa M/L/A e largeArc=0", () => {
    const startDeg = 0;
    const sweepDeg = 90;
    const path = pieSlicePath(cx, cy, outerR, 0, startDeg, sweepDeg);
    const o0 = pointOnCircle(cx, cy, outerR, startDeg);
    const o1 = pointOnCircle(cx, cy, outerR, startDeg + sweepDeg);
    expect(path).toBe(`M ${cx},${cy} L ${o0.x},${o0.y} A ${outerR},${outerR} 0 0 1 ${o1.x},${o1.y} Z`);
  });

  it("innerR igual a zero também cai no ramo de pizza cheia (mesmo path de innerR negativo)", () => {
    const pathZero = pieSlicePath(cx, cy, outerR, 0, 0, 90);
    const pathNegative = pieSlicePath(cx, cy, outerR, -3, 0, 90);
    expect(pathZero).toBe(pathNegative);
  });

  it("sweepDeg > 180° ativa largeArc = 1", () => {
    const startDeg = 0;
    const sweepDeg = 270;
    const path = pieSlicePath(cx, cy, outerR, 0, startDeg, sweepDeg);
    const o1 = pointOnCircle(cx, cy, outerR, startDeg + sweepDeg);
    expect(path).toContain(`A ${outerR},${outerR} 0 1 1 ${o1.x},${o1.y}`);
  });

  it("fatia de rosca (innerR > 0) desenha os dois arcos (externo e interno)", () => {
    const startDeg = 90;
    const sweepDeg = 90;
    const innerR = 4;
    const path = pieSlicePath(cx, cy, outerR, innerR, startDeg, sweepDeg);
    const endDeg = startDeg + sweepDeg;
    const o0 = pointOnCircle(cx, cy, outerR, startDeg);
    const o1 = pointOnCircle(cx, cy, outerR, endDeg);
    const i1 = pointOnCircle(cx, cy, innerR, endDeg);
    const i0 = pointOnCircle(cx, cy, innerR, startDeg);
    const expected =
      `M ${o0.x},${o0.y} A ${outerR},${outerR} 0 0 1 ${o1.x},${o1.y} ` +
      `L ${i1.x},${i1.y} A ${innerR},${innerR} 0 0 0 ${i0.x},${i0.y} Z`;
    expect(path).toBe(expected);
  });

  it("sweepDeg é travado em 359.99° (uma fatia sozinha não fecha o círculo inteiro)", () => {
    const startDeg = 0;
    const clamped = pieSlicePath(cx, cy, outerR, 0, startDeg, 360);
    const atClampValue = pieSlicePath(cx, cy, outerR, 0, startDeg, 359.99);
    // 360° e um valor já no teto do clamp (359.99°) devem produzir o mesmo path.
    expect(clamped).toBe(atClampValue);

    const o1AtClamp = pointOnCircle(cx, cy, outerR, startDeg + 359.99);
    const o1AtFull = pointOnCircle(cx, cy, outerR, startDeg + 360);
    expect(clamped).toContain(`${o1AtClamp.x},${o1AtClamp.y}`);
    // Garante que o clamp realmente evitou usar o ponto de 360° (que coincidiria com o de 0°).
    expect(o1AtClamp).not.toEqual(o1AtFull);
  });

  it("valores de sweepDeg abaixo do teto não são afetados pelo clamp", () => {
    const path = pieSlicePath(cx, cy, outerR, 0, 0, 45);
    const o1 = pointOnCircle(cx, cy, outerR, 45);
    expect(path).toContain(`${o1.x},${o1.y}`);
  });
});
