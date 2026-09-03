import { createContext, type ComponentType, type Ref } from "react";
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

// Os PRIMITIVOS que o editor renderiza por dentro, como um mapa que o
// consumidor pode substituir. É o que permite pôr o `Button` do MUI, o
// `Select` do Chakra ou o `Input` do design system da casa DENTRO do
// `<Designer>`, em vez de só em volta dele.
//
// São 12 chaves, e o conjunto é FECHADO de propósito: cada uma é contrato
// público e permanente. `ComponentType<P>` e não `FC<P>` — aceita função,
// classe, e resultado de `forwardRef` (que é o que os nossos são).
// `ref` entra no tipo de cada slot de propósito.
//
// Sem ele, `ComponentType<P>` não aceitaria `ref` e o editor não compilaria:
// o FormulaModal passa uma ref pro `Textarea` pra reposicionar o caret depois
// de aceitar uma sugestão. Uma função componente simples do consumidor
// continua atribuível (aceitar MENOS props é permitido por contravariância)
// — ela só ignora a ref, que é o comportamento "pode ignorar" documentado.
// Mas o `Textarea` é o slot em que ignorar QUEBRA algo, e por isso a ref
// dele é "obrigatório honrar" no contrato.
type Slot<P, E> = ComponentType<P & { ref?: Ref<E> }>;

// ATENÇÃO, e isto morde na prática: o slot recebe as props COMO O CHAMADOR
// AS ESCREVEU, e os defaults moram DENTRO dos nossos componentes.
//
// `<Button>` faz `{ variant = "primary", size = "sm" }` na desestruturação
// dele, então um chamador que escreve só `<Button>ok</Button>` manda
// `variant: undefined` — e o SEU adapter recebe `undefined`, não `"primary"`.
// Medido: dos 6 botões da Toolbar, 5 chegam sem `variant`.
//
// Um adapter que traduz nossos valores pros do design system dele precisa do
// próprio default:
//
//   Button: ({ variant = "primary", size = "sm", ...rest }: ButtonProps) => ...
//
// Os defaults do editor, pra copiar: `Button` variant="primary" size="sm";
// `Modal` size="lg"; `TabPanel` collapsed é obrigatório (sem default).
// Todo o resto das props não-DOM é opcional e sem default — ausente
// significa "não mostra" (`label`, `parts`, `mono`).

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

/** Substituição parcial — o que não vier fica sendo o nosso. */
export type UiComponentsOverride = Partial<UiComponents>;

// Exportado porque `{ Modal: undefined }` significa HERDA, não "volta ao
// default". Quem quer explicitamente voltar ao nosso escreve
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

// Default = os nossos, então um componente exportado usado SEM provider
// nenhum continua funcionando. Mesmo precedente do I18nContext, cujo default
// é o dicionário inglês.
//
// Em arquivo próprio, sem JSX: o fast-refresh do Vite reclama de misturar
// Context com componente no mesmo arquivo, e o oxlint tem a regra
// `react(only-export-components)`. É o mesmo split de três arquivos de
// src/i18n (contextValue.ts / context.tsx / hooks.ts).
export const UiComponentsContext = createContext<UiComponents>(defaultUiComponents);
