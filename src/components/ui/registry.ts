import { createContext, type ComponentType, type ForwardRefExoticComponent, type Ref, type RefAttributes } from "react";
import { Badge, Card, CardHeader, CardTitle } from "./Card";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { ColorInput, Input } from "./Input";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { TabPanel } from "./TabPanel";
import { Textarea } from "./Textarea";
import type { BadgeProps, CardProps, CardTitleProps } from "./Card";
import type { ButtonProps } from "./Button";
import type { CheckboxProps } from "./Checkbox";
import type { ColorInputProps, InputProps } from "./Input";
import type { ModalProps } from "./Modal";
import type { SelectProps } from "./Select";
import type { TabPanelProps } from "./TabPanel";
import type { TextareaProps } from "./Textarea";

// The PRIMITIVES the editor renders internally, as a map the consumer can
// replace. That is what allows putting MUI's `Button`, Chakra's `Select` or
// the house design system's `Input` INSIDE the `<Designer>`, instead of only
// around it.
//
// There are 12 keys, and the set is deliberately CLOSED: each one is a public
// and permanent contract. `ComponentType<P>` and not `FC<P>` — it accepts a
// function, a class, and the result of `forwardRef` (which is what ours are).
// `ref` is in each slot's type on purpose.
//
// Without it, `ComponentType<P>` would not accept `ref` and the editor would
// not compile: FormulaModal passes a ref to `Textarea` to reposition the caret
// after accepting a suggestion. A consumer's plain function component is still
// assignable (accepting FEWER props is allowed by contravariance) — it merely
// ignores the ref, which is the documented "may ignore" behavior. But
// `Textarea` is the slot where ignoring it BREAKS something, and that is why
// its ref is "must honor" in the contract.
//
// The UNION with `ForwardRefExoticComponent` exists because of an
// INCOMPATIBILITY BETWEEN THE TWO REACT MAJORS that `peerDependencies`
// accepts (`^18 || ^19`), and it only showed up when CI started running the
// 18 half of the range:
//
//   - in @types/react 18, `ExoticComponent` (what `forwardRef` returns) has a
//     call signature returning `ReactNode`, while the `FunctionComponent`
//     inside `ComponentType` returns `ReactElement | null` — narrower. Our own
//     components, all `forwardRef`, stopped being assignable to their own
//     slots (12 TS2322 errors in `defaultUiComponents`);
//   - in 19 `ref` became a normal prop and `ComponentType` alone is enough.
//
// The union covers both without loosening anything for the consumer: a plain
// function and a class still come in through `ComponentType`.
type Slot<P, E> =
  | ComponentType<P & { ref?: Ref<E> }>
  | ForwardRefExoticComponent<P & RefAttributes<E>>;

// WATCH OUT, and this bites in practice: the slot receives the props AS THE
// CALLER WROTE THEM, and the defaults live INSIDE our components.
//
// `<Button>` does `{ variant = "primary", size = "sm" }` in its own
// destructuring, so a caller writing only `<Button>ok</Button>` sends
// `variant: undefined` — and YOUR adapter receives `undefined`, not
// `"primary"`. Measured: of the Toolbar's 6 buttons, 5 arrive with no variant.
//
// An adapter translating our values into its design system's needs its own
// default:
//
//   Button: ({ variant = "primary", size = "sm", ...rest }: ButtonProps) => ...
//
// The editor's defaults, to copy: `Button` variant="primary" size="sm";
// `Modal` size="lg"; `TabPanel` collapsed is required (no default). Every
// other non-DOM prop is optional with no default — absent means "do not show"
// (`label`, `parts`, `mono`).

export type UiComponents = {
  Button: Slot<ButtonProps, HTMLButtonElement>;
  Input: Slot<InputProps, HTMLInputElement>;
  ColorInput: Slot<ColorInputProps, HTMLInputElement>;
  Select: Slot<SelectProps, HTMLSelectElement>;
  Textarea: Slot<TextareaProps, HTMLTextAreaElement>;
  Checkbox: Slot<CheckboxProps, HTMLInputElement>;
  Modal: Slot<ModalProps, HTMLDivElement>;
  Card: Slot<CardProps, HTMLDivElement>;
  CardHeader: Slot<CardProps, HTMLDivElement>;
  CardTitle: Slot<CardTitleProps, HTMLHeadingElement>;
  Badge: Slot<BadgeProps, HTMLSpanElement>;
  TabPanel: Slot<TabPanelProps, HTMLDivElement>;
};

/** A partial replacement — whatever is not passed stays ours. */
export type UiComponentsOverride = Partial<UiComponents>;

// Exported because `{ Modal: undefined }` means INHERIT, not "back to the
// default". Whoever explicitly wants ours back writes
// `{ Modal: defaultUiComponents.Modal }`.
export const defaultUiComponents: UiComponents = {
  Button,
  Input,
  ColorInput,
  Select,
  Textarea,
  Checkbox,
  Modal,
  Card,
  CardHeader,
  CardTitle,
  Badge,
  TabPanel,
};

// The default is ours, so an exported component used with NO provider at all
// keeps working. Same precedent as I18nContext, whose default is the English
// dictionary.
//
// In a file of its own, with no JSX: Vite's fast refresh complains about
// mixing a Context with a component in the same file, and oxlint has the
// `react(only-export-components)` rule. It is the same three-file split as
// src/i18n (contextValue.ts / context.tsx / hooks.ts).
export const UiComponentsContext = createContext<UiComponents>(defaultUiComponents);
