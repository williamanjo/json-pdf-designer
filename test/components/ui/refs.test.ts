import { describe, expect, it } from "vitest";
import * as kit from "../../../src/components/ui";

// The ref contract, as a test — because it is the kind of thing someone
// "simplifies" back into a function component months later, and nothing
// breaks until a consumer tries to use the ref.
//
// `forwardRef` and not React 19's `ref` prop: the peer accepts React 18
// (package.json), and there a function component does not receive `ref` directly.
const FORWARD_REF = Symbol.for("react.forward_ref");

// Components that render ONE addressable DOM node forward the ref to it.
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

// The icons are the DELIBERATE exception: 20 `forwardRef` wrappers for a use
// case nobody has. And that is why their props are `SVGAttributes` and NOT
// `SVGProps` — the latter extends `ClassAttributes`, which includes `ref`, and
// then the type would accept a ref that goes nowhere. The type would be lying.
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
