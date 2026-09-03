import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as kit from "../../../src/components/ui";
import { ModalShell } from "../../../src/components/ui/Modal";

// Contrato de passthrough, componente por componente.
//
// A regra da API de estilo do pacote é:
//
//   `className` / `style` / `...rest` vão pro elemento que dá NOME ao
//   componente. Todo outro elemento que ele renderiza é `parts`.
//
// Este arquivo prova a primeira metade pra TODOS. `renderToStaticMarkup` em
// vez de inspeção de árvore porque o que interessa aqui é o markup EMITIDO:
// se o atributo chegou, se a nossa classe base sobreviveu, e se não sobrou
// `class=""`. Não precisa de jsdom — `react-dom` já é devDep.

const PROBE = { className: "sonda-consumidor", style: { zIndex: 7 }, "data-sonda": "1" } as const;

// Um caso por componente. O `render` recebe as props de sonda e devolve o
// elemento; cada componente exige as props obrigatórias dele.
const CASES: Array<{ name: string; base: string; render: (p: Record<string, unknown>) => ReactElement }> = [
  { name: "Button", base: "jpd-btn", render: (p) => <kit.Button {...p}>ok</kit.Button> },
  { name: "Card", base: "jpd-card", render: (p) => <kit.Card {...p} /> },
  { name: "CardHeader", base: "jpd-card__header", render: (p) => <kit.CardHeader {...p} /> },
  { name: "CardTitle", base: "jpd-card__title", render: (p) => <kit.CardTitle {...p} /> },
  { name: "Badge", base: "jpd-badge", render: (p) => <kit.Badge {...p} /> },
  // Entrou na 3.0.0, junto com o export público: antes ele tinha um tipo de
  // props FECHADO (`{ icon, size }`) e a classe hardcoded. O validador da doc
  // pegou a inconsistência — o CHANGELOG prometia `className`/`style`/`...rest`
  // "em todos", e ele era o único que não cumpria.
  { name: "MaterialIcon", base: "jpd-micon", render: (p) => <kit.MaterialIcon icon="star" size={16} {...p} /> },
  { name: "Input", base: "jpd-input", render: (p) => <kit.Input {...p} /> },
  { name: "ColorInput", base: "jpd-color-input", render: (p) => <kit.ColorInput {...p} /> },
  { name: "Select", base: "jpd-select", render: (p) => <kit.Select {...p} /> },
  { name: "Checkbox", base: "jpd-checkline__box", render: (p) => <kit.Checkbox label="x" {...p} /> },
  { name: "Textarea", base: "jpd-textarea", render: (p) => <kit.Textarea {...p} /> },
  { name: "TabPanel", base: "jpd-tabpanel", render: (p) => <kit.TabPanel collapsed={false} {...p}>x</kit.TabPanel> },
  {
    name: "CollapsibleSection",
    base: "jpd-disclosure",
    render: (p) => (
      <kit.CollapsibleSection title="t" {...p}>
        x
      </kit.CollapsibleSection>
    ),
  },
  {
    name: "BulkLocked",
    base: "jpd-locked",
    render: (p) => (
      <kit.BulkLocked hint="h" {...p}>
        x
      </kit.BulkLocked>
    ),
  },
  { name: "PaletteSwatches", base: "jpd-swatches", render: (p) => <kit.PaletteSwatches colors={["#000"]} {...p} /> },
  {
    name: "PalettePicker",
    base: "jpd-palette",
    render: (p) => <kit.PalettePicker currentName="a" currentColors={["#000"]} onSelect={() => {}} groups={[]} {...p} />,
  },
  { name: "ClearFieldButton", base: "jpd-linkbtn", render: (p) => <kit.ClearFieldButton variant="text" label="x" onClick={() => {}} {...p} /> },
  // O `Modal` inteiro devolve `null` sem DOM (ele porta pro document.body),
  // então o caso é a casca — que existe separada exatamente por isso.
  {
    name: "Modal",
    base: "jpd-modal__panel",
    render: (p) => (
      <ModalShell title="t" onClose={() => {}} closeLabel="Close" {...p}>
        x
      </ModalShell>
    ),
  },
];

describe("passthrough de className/style/...rest", () => {
  for (const { name, base, render } of CASES) {
    it(`${name}: repassa className, style e atributo solto, sem perder a classe base`, () => {
      const html = renderToStaticMarkup(render(PROBE));
      expect(html, "className do consumidor não chegou").toContain("sonda-consumidor");
      expect(html, "a classe base do componente foi perdida").toContain(base);
      expect(html, "style do consumidor não chegou").toMatch(/z-index:\s*7/);
      expect(html, "atributo solto (...rest) não chegou").toContain('data-sonda="1"');
    });

    it(`${name}: sem className do consumidor, não emite class vazia`, () => {
      const html = renderToStaticMarkup(render({}));
      expect(html, 'sobrou class="" no markup').not.toContain('class=""');
    });
  }

  // A asserção que impede este arquivo de apodrecer: adicionar um componente
  // ao barrel sem dar passthrough a ele quebra a suíte, em vez de passar
  // silenciosamente por não estar na lista.
  it("a lista de casos cobre todo componente do barrel", () => {
    const exported = Object.entries(kit)
      .filter(([, value]) => typeof value === "function" || (typeof value === "object" && value !== null))
      .map(([name]) => name)
      // Os 20 `Icon*` ficam fora: `className` passa e `...rest` também, mas
      // eles não têm ref de propósito (ver icons.tsx e refs.test.ts). O
      // `MaterialIcon` NÃO está mais nesta exceção — desde a 3.0.0 ele honra
      // a regra inteira, e tem caso próprio acima.
      .filter((name) => !name.startsWith("Icon"));
    const covered = new Set(CASES.map((c) => c.name));
    const missing = exported.filter((name) => !covered.has(name));
    expect(missing, `componente exportado sem caso de passthrough:\n  ${missing.join("\n  ")}`).toEqual([]);
  });
});
