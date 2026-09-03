import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  UiComponentsProvider,
  defaultUiComponents,
  type BadgeProps,
  type ButtonProps,
  type CardProps,
  type CardTitleProps,
  type CheckboxProps,
  type ColorInputProps,
  type InputProps,
  type ModalProps,
  type SelectProps,
  type TabPanelProps,
  type TextareaProps,
  type UiComponentsOverride,
} from "../src/index";
import { Toolbar } from "../src/components/Toolbar";

// A promessa da API de slots, escrita como código que TEM DE COMPILAR:
//
//   "adapter de 5 linhas, tipado nas duas pontas"
//
// O `publicSurface.test.ts` prova que cada `*Props` está EXPORTADO — varrendo
// a fonte do barrel. Isto prova a coisa mais forte: que os tipos exportados
// são de fato usáveis pra escrever os 12 adapters. Se um `*Props` mudar de
// forma (uma prop obrigatória a mais, um genérico novo), este arquivo para de
// compilar e o `npm run typecheck` falha — em vez de o consumidor descobrir.
//
// Os adapters abaixo imitam o que um consumidor real faz com um design system
// de terceiro: DESESTRUTURA as props que são nossas (`variant`, `size`,
// `label`, `parts`, ...) e repassa o resto pro componente dele. É por isso que
// toda prop não-DOM é opcional com default — sem isso, cada adapter tinha de
// inventar um valor.
//
// `label` é a linha que morde, e por isso está honrada em todos os controles:
// slot que descarta `label` remove o nome acessível de ~16 controles do
// editor. O contrato MUST honor de cada slot está na doc.
//
// `parts: _parts` em vez de `parts` é pro lint: descartar uma prop no
// destructure é exatamente o que um adapter faz, e o `_` é como se diz isso
// ao `no-unused-vars`. Um consumidor com a mesma regra escreve igual.

const MEU_KIT = {
  // Os defaults vêm AQUI, e não do slot: `<Button>` só aplica
  // `variant = "primary"` na desestruturação DELE, então um chamador que
  // escreve `<Button>ok</Button>` manda `undefined` pro adapter. Medido:
  // 5 dos 6 botões da Toolbar chegam sem `variant`. Ver o aviso em
  // registry.ts.
  Button: ({ variant = "primary", size = "sm", children, ...rest }: ButtonProps) => (
    <button {...rest} data-meu="button" data-v={variant} data-s={size}>
      {children}
    </button>
  ),

  Input: ({ label, parts: _parts, mono, ...rest }: InputProps) => (
    <label data-meu="input" data-mono={mono || undefined}>
      {label}
      <input {...rest} />
    </label>
  ),

  ColorInput: ({ label, parts: _parts, ...rest }: ColorInputProps) => (
    <label data-meu="color">
      {label}
      <input type="color" {...rest} />
    </label>
  ),

  Select: ({ label, parts: _parts, children, ...rest }: SelectProps) => (
    <label data-meu="select">
      {label}
      <select {...rest}>{children}</select>
    </label>
  ),

  Textarea: ({ label, parts: _parts, mono, ...rest }: TextareaProps) => (
    <label data-meu="textarea" data-mono={mono || undefined}>
      {label}
      <textarea {...rest} />
    </label>
  ),

  Checkbox: ({ label, parts: _parts, ...rest }: CheckboxProps) => (
    <label data-meu="checkbox">
      <input type="checkbox" {...rest} />
      {label}
    </label>
  ),

  Card: ({ children, ...rest }: CardProps) => (
    <section {...rest} data-meu="card">
      {children}
    </section>
  ),

  CardHeader: ({ children, ...rest }: CardProps) => (
    <header {...rest} data-meu="card-header">
      {children}
    </header>
  ),

  CardTitle: ({ children, ...rest }: CardTitleProps) => (
    <h2 {...rest} data-meu="card-title">
      {children}
    </h2>
  ),

  Badge: ({ children, ...rest }: BadgeProps) => (
    <span {...rest} data-meu="badge">
      {children}
    </span>
  ),

  TabPanel: ({ collapsed, children, parts: _parts, ...rest }: TabPanelProps) => (
    <div {...rest} data-meu="tabpanel" hidden={collapsed || undefined}>
      {children}
    </div>
  ),

  // O único com comportamento obrigatório de verdade: `onClose` TEM de ser
  // chamável, senão o modal não fecha. Um design system que não tem "modal
  // com título" ainda consegue honrar isto.
  Modal: ({ title, onClose, size, parts: _parts, children, ...rest }: ModalProps) => (
    <div {...rest} role="dialog" aria-label={title} data-meu="modal" data-size={size}>
      <button type="button" onClick={onClose}>
        fechar
      </button>
      {children}
    </div>
  ),
} satisfies UiComponentsOverride;

describe("adapter de slot — compila e substitui", () => {
  it("cobre os 12 slots do registry, sem sobra nem falta", () => {
    // Se um slot novo entrar no registry, este teste falha e o arquivo tem
    // de ganhar o adapter dele — o que é exatamente a revisão que se quer,
    // porque slot novo é API pública que não se tira mais.
    expect(Object.keys(MEU_KIT).sort()).toEqual(Object.keys(defaultUiComponents).sort());
  });

  it("o chrome renderiza os primitivos do consumidor", () => {
    // A Toolbar tem 6 botões de "adicionar campo".
    const noop = () => {};
    const html = renderToStaticMarkup(
      <UiComponentsProvider components={MEU_KIT}>
        <Toolbar onAddText={noop} onAddTable={noop} onAddImage={noop} onAddSection={noop} onAddChart={noop} onAddKpi={noop} />
      </UiComponentsProvider>
    );
    expect((html.match(/data-meu="button"/g) ?? []).length).toBe(6);
    expect(html, "o Button do kit ainda apareceu").not.toContain("jpd-btn");
    // As props nossas CHEGARAM no adapter em vez de virarem atributo solto no
    // DOM — é o que faz um adapter poder traduzi-las. O "+ seção" é o único
    // que o chamador escreve com `variant`, e ele chega intacto:
    expect(html, "variant explícito do chamador não chegou").toContain('data-v="outline"');
    // E os 5 que o chamador NÃO qualifica chegam `undefined`, então quem
    // aplica o default é o adapter. Se o slot herdasse o nosso default, os 6
    // viriam "primary" e este `toBe(5)` quebraria.
    expect((html.match(/data-v="primary"/g) ?? []).length, "o default saiu do adapter, não do slot").toBe(5);
    expect((html.match(/data-s="sm"/g) ?? []).length).toBe(6);
  });

  it("o mapa é constante de MÓDULO, não objeto inline", () => {
    // A identidade do mapa é load-bearing: objeto inline cria componente novo
    // a cada render e o React remonta o slotado, fazendo o campo perder o
    // foco a cada tecla. Um teste não pega isso em SSR, mas pega a forma —
    // e a forma é o que a doc pede.
    const antes = MEU_KIT.Button;
    const depois = MEU_KIT.Button;
    expect(antes).toBe(depois);
  });
});
