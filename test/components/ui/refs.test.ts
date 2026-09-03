import { describe, expect, it } from "vitest";
import * as kit from "../../../src/components/ui";

// Contrato de ref, como teste — porque é o tipo de coisa que alguém
// "simplifica" de volta pra função componente meses depois, e nada quebra
// até um consumidor tentar usar a ref.
//
// `forwardRef` e não a prop `ref` do React 19: o peer aceita React 18
// (package.json), e ali função componente não recebe `ref` direto.
const FORWARD_REF = Symbol.for("react.forward_ref");

// Componentes que renderizam UM nó de DOM endereçável repassam a ref pra ele.
const REPASSAM = [
  "Button",
  "Card",
  "CardHeader",
  "CardTitle",
  "Badge",
  "Input",
  "ColorInput",
  "Select",
  "Textarea",
  "Checkbox",
  "Modal",
  "TabPanel",
  "CollapsibleSection",
  "BulkLocked",
  "PaletteSwatches",
  "PalettePicker",
  "ClearFieldButton",
] as const;

// Os ícones são a exceção DELIBERADA: 20 wrappers de `forwardRef` pra um caso
// de uso que ninguém tem. E por isso as props deles são `SVGAttributes` e
// NÃO `SVGProps` — este último estende `ClassAttributes`, que inclui `ref`, e
// aí o tipo aceitaria uma ref que não vai a lugar nenhum. O tipo mentiria.
const NAO_REPASSAM = ["MaterialIcon", "IconPlus", "IconX", "IconTrash", "IconLock", "IconAlertTriangle"] as const;

describe("contrato de ref do kit", () => {
  for (const name of REPASSAM) {
    it(`${name} repassa ref`, () => {
      const c = (kit as Record<string, unknown>)[name] as { $$typeof?: symbol } | undefined;
      expect(c, `${name} não está exportado do barrel`).toBeDefined();
      expect(c?.$$typeof, `${name} deixou de ser forwardRef — a ref do consumidor virou no-op`).toBe(FORWARD_REF);
    });
  }

  for (const name of NAO_REPASSAM) {
    it(`${name} NÃO repassa ref, de propósito`, () => {
      const c = (kit as Record<string, unknown>)[name] as { $$typeof?: symbol } | undefined;
      expect(c, `${name} não está exportado do barrel`).toBeDefined();
      expect(c?.$$typeof, `${name} virou forwardRef — os ícones são glifos, não precisam`).not.toBe(FORWARD_REF);
      expect(typeof c, `${name} deveria ser função componente simples`).toBe("function");
    });
  }

  it("todo componente do barrel está classificado", () => {
    // Sem isto, adicionar um componente novo e esquecer a ref passa em
    // silêncio — o mesmo tipo de rot que a asserção de completude do
    // passthrough.test.tsx cobre.
    const componentes = Object.entries(kit)
      .filter(([, v]) => typeof v === "function" || (typeof v === "object" && v !== null && "$$typeof" in (v as object)))
      .map(([name]) => name);
    const classificados = new Set<string>([...REPASSAM, ...NAO_REPASSAM]);
    const naoClassificados = componentes.filter((n) => !classificados.has(n) && !n.startsWith("Icon"));
    expect(naoClassificados, `componente sem decisão de ref:\n  ${naoClassificados.join("\n  ")}`).toEqual([]);
  });
});
