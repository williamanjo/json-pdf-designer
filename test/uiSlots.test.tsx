import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Toolbar } from "../src/components/Toolbar";
import { defaultUiComponents } from "../src/components/ui/registry";
import { UiComponentsProvider } from "../src/components/ui/UiComponentsProvider";
import { relativeToSrc, sourceFiles, stripComments } from "./support/classScan";
import type { ButtonProps, SelectProps } from "../src/components/ui";

// Guards do registry de primitivos (`UiComponentsProvider`).
//
// Quatro coisas, e três delas quebram em silêncio: a lista de slots é
// contrato permanente, a recursão só aparece quando um consumidor escreve o
// adapter mais óbvio que existe, e "o chrome roteia pelo registry" é
// invisível até alguém trocar um primitivo e nada mudar na tela.

describe("registry — conjunto de slots", () => {
  it("tem exatamente as 12 chaves declaradas", () => {
    // Adicionar slot passa a ser edição DELIBERADA e revisada: cada chave é
    // API pública que não se tira mais.
    expect(Object.keys(defaultUiComponents).sort()).toEqual(
      ["Badge", "Button", "Card", "CardHeader", "CardTitle", "Checkbox", "ColorInput", "Input", "Modal", "Select", "TabPanel", "Textarea"].sort()
    );
  });
});

describe("registry — invariante anti-recursão", () => {
  // Um primitivo SLOTÁVEL não pode ler o registry. Se lesse, este adapter —
  // o mais natural que existe, embrulhar o nosso pra ajustar algo —
  //
  //   { Button: (p) => <Button {...p} className={cx("meu", p.className)} /> }
  //
  // recursionaria pra sempre.
  const SLOTAVEIS = [
    "components/ui/Button.tsx",
    "components/ui/Card.tsx",
    "components/ui/Checkbox.tsx",
    "components/ui/Input.tsx",
    "components/ui/Modal.tsx",
    "components/ui/Select.tsx",
    "components/ui/TabPanel.tsx",
    "components/ui/Textarea.tsx",
  ];
  // Compostos LEEM o registry de propósito — é o que faz trocar `Button`
  // restilizar também os botões que o consumidor não sabe que existem.
  const COMPOSTOS = ["components/ui/ClearFieldButton.tsx"];

  const lê = (rel: string) => {
    const file = sourceFiles().find((f) => relativeToSrc(f) === rel);
    expect(file, `arquivo não encontrado: ${rel}`).toBeDefined();
    return stripComments(readFileSync(file as string, "utf8"));
  };

  for (const rel of SLOTAVEIS) {
    it(`${rel.split("/").pop()} NÃO lê o registry`, () => {
      const code = lê(rel);
      expect(/useUiComponents|from "\.\/registry"/.test(code), `${rel} lê o registry — recursão infinita no adapter que embrulha o nosso componente`).toBe(false);
    });
  }

  // Caso de CONTROLE: sem isto, uma varredura quebrada passaria vazia e os
  // testes acima seriam vácuo. Mesma proteção do entryBoundaries.test.ts.
  for (const rel of COMPOSTOS) {
    it(`${rel.split("/").pop()} LÊ o registry (controle da varredura)`, () => {
      expect(/useUiComponents/.test(lê(rel))).toBe(true);
    });
  }
});

describe("registry — o chrome roteia pelo registry", () => {
  it("nenhum arquivo de chrome importa primitivo concreto do kit", () => {
    // Sem isto, um PR futuro escreve `import { Button } from "./ui"` e
    // reintroduz em silêncio um botão que o consumidor não consegue trocar.
    const SLOTS = ["Badge", "Button", "Card", "CardHeader", "CardTitle", "Checkbox", "ColorInput", "Input", "Modal", "Select", "TabPanel", "Textarea"];
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const rel = relativeToSrc(file);
      // O próprio kit e o registry importam concretamente — é o trabalho deles.
      if (rel.startsWith("components/ui/")) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]*ui(?:\/index)?"/g)) {
        const named = m[1]
          .split(",")
          .map((x) => x.trim().replace(/^type\s+/, ""))
          .filter(Boolean);
        const concretos = named.filter((n) => SLOTS.includes(n));
        if (concretos.length) offenders.push(`src/${rel}: ${concretos.join(", ")}`);
      }
    }
    expect(offenders, `chrome importando primitivo concreto (use useUiComponents):\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});

describe("registry — sonda de comportamento", () => {
  const Sonda = (p: ButtonProps) => <button data-sonda="1">{p.children}</button>;

  it("o chrome renderiza o Button do consumidor, e não o nosso", () => {
    // Este é o teste que prova o mecanismo inteiro, e não precisa de DOM.
    // Toolbar renderiza 6 botões de "adicionar campo".
    const noop = () => {};
    const toolbar = (
      <Toolbar onAddText={noop} onAddTable={noop} onAddImage={noop} onAddSection={noop} onAddChart={noop} onAddKpi={noop} />
    );

    const nosso = renderToStaticMarkup(toolbar);
    expect((nosso.match(/jpd-btn/g) ?? []).length).toBe(6);
    expect(nosso).not.toContain("data-sonda");

    const doConsumidor = renderToStaticMarkup(<UiComponentsProvider components={{ Button: Sonda }}>{toolbar}</UiComponentsProvider>);
    expect((doConsumidor.match(/data-sonda/g) ?? []).length).toBe(6);
    expect(doConsumidor, "o Button do kit ainda apareceu").not.toContain("jpd-btn");
  });

  it("substituição PARCIAL: o que não foi trocado continua sendo o nosso", () => {
    const SondaSelect = (p: SelectProps) => <select data-sonda-select="1">{p.children}</select>;
    // Trocando só o Select, o Button segue sendo o nosso.
    const html = renderToStaticMarkup(
      <UiComponentsProvider components={{ Select: SondaSelect }}>
        <Toolbar
          onAddText={() => {}}
          onAddTable={() => {}}
          onAddImage={() => {}}
          onAddSection={() => {}}
          onAddChart={() => {}}
          onAddKpi={() => {}}
        />
      </UiComponentsProvider>
    );
    expect(html).toContain("jpd-btn");
    expect(html).not.toContain("data-sonda-select");
  });

  it("`undefined` numa chave significa HERDA, não volta-ao-default", () => {
    const html = renderToStaticMarkup(
      <UiComponentsProvider components={{ Button: Sonda }}>
        <UiComponentsProvider components={{ Button: undefined }}>
          <Toolbar
            onAddText={() => {}}
            onAddTable={() => {}}
            onAddImage={() => {}}
            onAddSection={() => {}}
            onAddChart={() => {}}
            onAddKpi={() => {}}
          />
        </UiComponentsProvider>
      </UiComponentsProvider>
    );
    expect(html, "o provider de dentro deveria HERDAR a sonda do de fora").toContain("data-sonda");
  });

  it("sem provider nenhum, o chrome usa os nossos — nada explode", () => {
    // Mesmo precedente do I18nContext, cujo default é o dicionário inglês:
    // um componente exportado usado avulso continua funcionando.
    const html = renderToStaticMarkup(
      <Toolbar
        onAddText={() => {}}
        onAddTable={() => {}}
        onAddImage={() => {}}
        onAddSection={() => {}}
        onAddChart={() => {}}
        onAddKpi={() => {}}
      />
    );
    expect(html).toContain("jpd-btn");
  });
});

// Sanidade: o arquivo de teste referencia o caminho real do registry.
it("o registry mora onde os guards procuram", () => {
  const p = join(__dirname, "..", "src", "components", "ui", "registry.ts");
  expect(readFileSync(p, "utf8")).toContain("UiComponentsContext");
});
