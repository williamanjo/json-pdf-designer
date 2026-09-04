import { describe, expect, it } from "vitest";
import { defaultKpiElementPositions, kpiBorderRadius, kpiElementLocked, kpiElementLockedPatch, kpiElementOffset, kpiElementOffsetPatch, kpiElementPresent, kpiElementRestorePatch } from "../../../src/fields/kpi/card";
import { formatKpiValue } from "../../../src/fields/kpi/format";
import { en } from "../../../src/i18n/locales/en";
import { ptToMm } from "../../../src/page/units";
import type { KpiElementKey, KpiElementOffset, KpiSchema } from "../../../src/types";

function makeKpi(overrides: Partial<KpiSchema> = {}): KpiSchema {
  return {
    id: "k1",
    name: "kpi1",
    type: "kpi",
    x: 0,
    y: 0,
    width: 55,
    height: 35,
    icon: "bar_chart",
    title: "Título",
    value: "0",
    subtitle: "Legenda",
    backgroundColor: "#2563eb",
    textColor: "#ffffff",
    ...overrides,
  };
}

describe("kpiBorderRadius", () => {
  it("0% é sempre canto reto (0), independente do tamanho do cartão", () => {
    expect(kpiBorderRadius(0, 55, 35)).toBe(0);
    expect(kpiBorderRadius(0, 200, 10)).toBe(0);
  });

  it("100% é metade do lado MENOR (pílula) — largura maior que altura", () => {
    expect(kpiBorderRadius(100, 55, 35)).toBe(17.5);
  });

  it("100% é metade do lado MENOR (pílula) — altura maior que largura", () => {
    expect(kpiBorderRadius(100, 20, 40)).toBe(10);
  });

  it("percentual intermediário escala linearmente com o lado menor", () => {
    expect(kpiBorderRadius(50, 55, 35)).toBe(8.75);
    expect(kpiBorderRadius(16, 55, 35)).toBeCloseTo((16 / 100) * (35 / 2), 10);
  });
});

describe("formatKpiValue", () => {
  it("format ausente/undefined passa o valor direto", () => {
    expect(formatKpiValue("10000")).toBe("10000");
    expect(formatKpiValue("R$ 42")).toBe("R$ 42");
  });

  it('format "none" passa o valor direto', () => {
    expect(formatKpiValue("10000", "none")).toBe("10000");
  });

  it("valor vazio ou só espaço passa direto (sem tocar), mesmo com format definido", () => {
    expect(formatKpiValue("", "grouped")).toBe("");
    expect(formatKpiValue("   ", "plain")).toBe("   ");
  });

  it("valor não-numérico (com prefixo/sufixo) passa direto, sem quebrar", () => {
    expect(formatKpiValue("R$ 42", "plain")).toBe("R$ 42");
    expect(formatKpiValue("42 unid.", "grouped")).toBe("42 unid.");
  });

  it('format "plain" só limita casas decimais, sem separador de milhar', () => {
    expect(formatKpiValue("10000", "plain")).toBe("10000");
    expect(formatKpiValue("42", "plain")).toBe("42");
    expect(formatKpiValue("1234.567", "plain")).toBe("1234,57");
  });

  it('format "grouped" agrupa milhar (ponto) em pt-BR', () => {
    expect(formatKpiValue("10000", "grouped")).toBe("10.000");
    expect(formatKpiValue("1234.5", "grouped")).toBe("1.234,5");
  });

  it("número já com decimais mantém as casas (até 2), sem forçar zero", () => {
    expect(formatKpiValue("10000.5", "grouped")).toBe("10.000,5");
    expect(formatKpiValue("10000", "grouped")).not.toBe("10.000,00");
  });
});

describe("defaultKpiElementPositions", () => {
  const PADDING_MM = ptToMm(8);

  it("título no canto superior-esquerdo, ícone no superior-direito, valor centralizado, legenda no inferior-esquerdo", () => {
    const schema = makeKpi({ width: 55, height: 35 });
    const sizesMm = { icon: 5, title: 3, value: 8, subtitle: 3 };
    const positions = defaultKpiElementPositions(schema, sizesMm);

    expect(positions.title).toEqual({ x: PADDING_MM, y: PADDING_MM });
    expect(positions.icon).toEqual({ x: 55 - PADDING_MM - sizesMm.icon, y: PADDING_MM });
    expect(positions.value).toEqual({ x: PADDING_MM, y: 35 / 2 - sizesMm.value / 2 });
    expect(positions.subtitle).toEqual({ x: PADDING_MM, y: 35 - PADDING_MM - sizesMm.subtitle });
  });

  it("ícone/legenda nunca saem do cartão pra fora (clamp em PADDING_MM) quando o elemento é maior que o cartão", () => {
    const schema = makeKpi({ width: 10, height: 10 });
    const sizesMm = { icon: 50, title: 3, value: 8, subtitle: 50 };
    const positions = defaultKpiElementPositions(schema, sizesMm);

    expect(positions.icon).toEqual({ x: PADDING_MM, y: PADDING_MM });
    expect(positions.subtitle).toEqual({ x: PADDING_MM, y: PADDING_MM });
  });
});

// Tabela única cobrindo os 4 sub-elementos (icon/title/value/subtitle) pros
// helpers de leitura/escrita compartilhados entre KpiField.tsx, FieldList.tsx
// e PropertyPanelKpi.tsx — cada helper só lê/escreve o campo certo por
// elemento (ver kpi/card.ts).
const ELEMENTS: KpiElementKey[] = ["icon", "title", "value", "subtitle"];

describe.each(ELEMENTS)("helpers de sub-elemento KPI — %s", (el) => {
  const offsetFieldKey = `${el}Offset` as const;
  const lockedFieldKey = `${el}Locked` as const;
  const someOffset: KpiElementOffset = { x: 3, y: 4 };

  it("kpiElementPresent reflete o campo certo (icon: !=='none'; demais: !==undefined)", () => {
    if (el === "icon") {
      expect(kpiElementPresent(makeKpi({ icon: "bar_chart" }), el)).toBe(true);
      expect(kpiElementPresent(makeKpi({ icon: "none" }), el)).toBe(false);
    } else {
      expect(kpiElementPresent(makeKpi({ [el]: "algo" } as Partial<KpiSchema>), el)).toBe(true);
      expect(kpiElementPresent(makeKpi({ [el]: undefined } as Partial<KpiSchema>), el)).toBe(false);
    }
  });

  it("kpiElementOffset lê o campo `<el>Offset` certo", () => {
    const schema = makeKpi({ [offsetFieldKey]: someOffset } as Partial<KpiSchema>);
    expect(kpiElementOffset(schema, el)).toEqual(someOffset);
    expect(kpiElementOffset(makeKpi(), el)).toBeUndefined();
  });

  it("kpiElementLocked é true por padrão (ausente) e só false quando explicitamente false", () => {
    expect(kpiElementLocked(makeKpi(), el)).toBe(true);
    expect(kpiElementLocked(makeKpi({ [lockedFieldKey]: true } as Partial<KpiSchema>), el)).toBe(true);
    expect(kpiElementLocked(makeKpi({ [lockedFieldKey]: false } as Partial<KpiSchema>), el)).toBe(false);
  });

  it("kpiElementOffsetPatch grava só o campo `<el>Offset`", () => {
    expect(kpiElementOffsetPatch(el, someOffset)).toEqual({ [offsetFieldKey]: someOffset });
    expect(kpiElementOffsetPatch(el, undefined)).toEqual({ [offsetFieldKey]: undefined });
  });

  it("kpiElementLockedPatch grava só o campo `<el>Locked`", () => {
    expect(kpiElementLockedPatch(el, true)).toEqual({ [lockedFieldKey]: true });
    expect(kpiElementLockedPatch(el, false)).toEqual({ [lockedFieldKey]: false });
  });

  it("kpiElementRestorePatch devolve o default certo por elemento (título/legenda traduzidos)", () => {
    const patch = kpiElementRestorePatch(el, en);
    if (el === "icon") expect(patch).toEqual({ icon: "bar_chart" });
    else if (el === "title") expect(patch).toEqual({ title: en.kpi.title });
    else if (el === "value") expect(patch).toEqual({ value: "0" });
    else expect(patch).toEqual({ subtitle: en.kpi.subtitle });
  });
});
