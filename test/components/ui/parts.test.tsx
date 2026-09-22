import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BulkLocked, CollapsibleSection, ColorInput, Input, PaletteSwatches, Select, TabPanel, Textarea } from "../../../src/components/ui";
import { ModalShell } from "../../../src/components/ui/Modal";

// The SECOND half of the styling contract: whatever is not the element that
// names the component is addressed through `parts`, by role.
//
// What these tests prove, and the passthrough one does not: that the class
// lands on the RIGHT element. `<Input className>` has to go to the `<input>`
// and `parts.root` to the `<label>` that wraps it — if both landed in the same
// place, the API would compile and be silently wrong.

// Markup order: in `Labeled`, the `<label>` wraps the label's `<span>` and
// only then the control. So the class's position in the HTML says which
// element it landed on.
function positions(html: string, ...needles: string[]): number[] {
  return needles.map((n) => html.indexOf(n));
}

describe("parts — a classe cai no elemento certo", () => {
  it("Input: className vai pro <input>, parts.root pro <label>, parts.label pro <span>", () => {
    const html = renderToStaticMarkup(
      <Input label="Nome" className="no-controle" parts={{ root: "no-wrapper", label: "no-rotulo" }} />
    );
    const [wrapper, rotulo, controle] = positions(html, "no-wrapper", "no-rotulo", "no-controle");
    expect(wrapper).toBeGreaterThanOrEqual(0);
    // The wrapper opens before the label, which comes before the control.
    expect(wrapper).toBeLessThan(rotulo);
    expect(rotulo).toBeLessThan(controle);
    // And the control really is the <input>.
    expect(html).toMatch(/<input[^>]*no-controle/);
    expect(html).toMatch(/<label[^>]*no-wrapper/);
  });

  it("Input sem label devolve o controle NU — é a saída pra quem quer o próprio wrapper", () => {
    const html = renderToStaticMarkup(<Input className="x" />);
    expect(html.startsWith("<input")).toBe(true);
    expect(html).not.toContain("<label");
  });

  it("ColorInput, Select e Textarea seguem a mesma divisão", () => {
    for (const html of [
      renderToStaticMarkup(<ColorInput label="C" className="ctrl" parts={{ root: "wrap" }} />),
      renderToStaticMarkup(<Select label="S" className="ctrl" parts={{ root: "wrap" }} />),
      renderToStaticMarkup(<Textarea label="T" className="ctrl" parts={{ root: "wrap" }} />),
    ]) {
      expect(html).toMatch(/<label[^>]*wrap/);
      expect(html.indexOf("wrap")).toBeLessThan(html.indexOf("ctrl"));
    }
  });

  it("aceita as duas formas: atalho de string e objeto com style", () => {
    const comString = renderToStaticMarkup(<Input label="N" parts={{ label: "so-classe" }} />);
    expect(comString).toContain("so-classe");

    const comObjeto = renderToStaticMarkup(<Input label="N" parts={{ label: { className: "c", style: { opacity: 0.5 } } }} />);
    expect(comObjeto).toContain("c");
    expect(comObjeto).toMatch(/opacity:\s*\.?0?\.5/);
  });

  it("Modal: className é o PAINEL, parts.overlay é o fundo escurecido", () => {
    const html = renderToStaticMarkup(
      <ModalShell
        title="T"
        onClose={() => {}}
        closeLabel="Fechar"
        className="no-painel"
        footer={<span>f</span>}
        parts={{ overlay: "no-fundo", header: "no-header", title: "no-titulo", body: "no-body", footer: "no-footer" }}
      >
        conteudo
      </ModalShell>
    );
    // The overlay opens before the panel — it is the one that wraps.
    expect(html.indexOf("no-fundo")).toBeLessThan(html.indexOf("no-painel"));
    for (const cls of ["no-header", "no-titulo", "no-body", "no-footer"]) {
      expect(html, `parts.${cls} não chegou`).toContain(cls);
    }
    // E o título é um heading, não uma div qualquer.
    expect(html).toMatch(/<h3[^>]*no-titulo/);
  });

  it("TabPanel, CollapsibleSection, BulkLocked e PaletteSwatches endereçam suas partes", () => {
    const tab = renderToStaticMarkup(
      <TabPanel collapsed={false} className="raiz" parts={{ content: "corpo" }}>
        x
      </TabPanel>
    );
    expect(tab.indexOf("raiz")).toBeLessThan(tab.indexOf("corpo"));

    const disc = renderToStaticMarkup(
      <CollapsibleSection title="T" className="raiz" parts={{ summary: "resumo", content: "corpo" }}>
        x
      </CollapsibleSection>
    );
    expect(disc).toMatch(/<summary[^>]*resumo/);
    expect(disc.indexOf("resumo")).toBeLessThan(disc.indexOf("corpo"));

    const locked = renderToStaticMarkup(
      <BulkLocked hint="h" className="raiz" parts={{ hint: "dica", content: "corpo" }}>
        x
      </BulkLocked>
    );
    expect(locked).toMatch(/<p[^>]*dica/);
    expect(locked.indexOf("dica")).toBeLessThan(locked.indexOf("corpo"));

    const sw = renderToStaticMarkup(<PaletteSwatches colors={["#abcdef"]} className="raiz" parts={{ swatch: "bolinha" }} />);
    expect(sw).toContain("bolinha");
    // A cor da paleta continua inline: é DADO, não tema.
    expect(sw).toMatch(/background-color:\s*#abcdef/i);
  });

  it("chave de parts não vaza como atributo no DOM", () => {
    // `parts` é prop nossa; se escapasse pro spread, o React emitiria
    // `parts="[object Object]"` e o console avisaria em dev.
    const html = renderToStaticMarkup(<Input label="N" parts={{ root: "r" }} />);
    expect(html).not.toContain("parts=");
  });
});
