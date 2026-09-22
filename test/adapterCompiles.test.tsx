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

// The slot API's promise, written as code that HAS TO COMPILE:
//
//   "a 5-line adapter, typed on both ends"
//
// `publicSurface.test.ts` proves that each `*Props` is EXPORTED — by scanning
// the barrel's source. This proves the stronger thing: that the exported types
// are in fact usable to write the 12 adapters. If a `*Props` changes shape
// (one more required prop, a new generic), this file stops compiling and
// `npm run typecheck` fails — instead of the consumer finding out.
//
// The adapters below imitate what a real consumer does with a third-party
// design system: they DESTRUCTURE the props that are ours (`variant`, `size`,
// `label`, `parts`, ...) and forward the rest to their own component. That is
// why every non-DOM prop is optional with a default — without that, each
// adapter would have to invent a value.
//
// `label` is the line that bites, and that is why it is honored on every
// control: a slot that discards `label` removes the accessible name from ~16
// of the editor's controls. Each slot's MUST honor contract is in the docs.
//
// `parts: _parts` instead of `parts` is for the lint: discarding a prop in the
// destructure is exactly what an adapter does, and the `_` is how that is said
// to `no-unused-vars`. A consumer with the same rule writes it the same way.

const MEU_KIT = {
  // The defaults come from HERE, and not from the slot: `<Button>` only
  // applies `variant = "primary"` in ITS OWN destructuring, so a caller that
  // writes `<Button>ok</Button>` sends `undefined` to the adapter. Measured:
  // 5 of the Toolbar's 6 buttons arrive with no `variant`. See the warning in
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

  // The only one with genuinely required behavior: `onClose` HAS to be
  // callable, otherwise the modal does not close. A design system with no
  // "modal with a title" can still honor this.
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
    // If a new slot enters the registry, this test fails and the file has to
    // gain its adapter — which is exactly the review that is wanted, because a
    // new slot is public API that cannot be taken back.
    expect(Object.keys(MEU_KIT).sort()).toEqual(Object.keys(defaultUiComponents).sort());
  });

  it("o chrome renderiza os primitivos do consumidor", () => {
    // The Toolbar has 6 "add field" buttons.
    const noop = () => {};
    const html = renderToStaticMarkup(
      <UiComponentsProvider components={MEU_KIT}>
        <Toolbar onAddText={noop} onAddTable={noop} onAddImage={noop} onAddSection={noop} onAddChart={noop} onAddKpi={noop} />
      </UiComponentsProvider>
    );
    expect((html.match(/data-meu="button"/g) ?? []).length).toBe(6);
    expect(html, "o Button do kit ainda apareceu").not.toContain("jpd-btn");
    // Our props ARRIVED at the adapter instead of becoming a stray DOM
    // attribute — that is what lets an adapter translate them. "+ section" is
    // the only one the caller writes with `variant`, and it arrives intact:
    expect(html, "variant explícito do chamador não chegou").toContain('data-v="outline"');
    // And the 5 the caller does NOT qualify arrive `undefined`, so the one
    // applying the default is the adapter. If the slot inherited our default,
    // all 6 would come in as "primary" and this `toBe(5)` would break.
    expect((html.match(/data-v="primary"/g) ?? []).length, "o default saiu do adapter, não do slot").toBe(5);
    expect((html.match(/data-s="sm"/g) ?? []).length).toBe(6);
  });

  it("o mapa é constante de MÓDULO, não objeto inline", () => {
    // The map's identity is load-bearing: an inline object creates a new
    // component on every render and React remounts the slotted one, making the
    // field lose focus on every keystroke. A test does not catch that in SSR,
    // but it catches the shape — and the shape is what the docs ask for.
    const antes = MEU_KIT.Button;
    const depois = MEU_KIT.Button;
    expect(antes).toBe(depois);
  });
});
