import { createContext } from "react";
import type { Dispatch, DragEvent, SetStateAction } from "react";
import type { Binding, DataSourceOption, Template } from "../../types";
import type { DesignerActions } from "../actions";
import type { useSelection } from "../useSelection";
import type { useTabBar, TabKey } from "../useTabBar";

// Os cinco contextos do editor. Ficam num .ts (não .tsx) porque o arquivo
// não exporta componente nenhum — regra oxlint react(only-export-components),
// mesmo split de três arquivos que src/i18n/ usa (context.tsx /
// contextValue.ts / hooks.ts).
//
// POR QUE CINCO, e não um: cada peça posicionável assina só o que lê, e o
// React re-renderiza um consumidor quando o VALUE do contexto que ele lê
// troca de identidade — não quando o provider re-renderiza. Um contexto só
// faria toda peça re-renderizar a cada tecla digitada num campo de texto.
//
// A divisão é por FREQUÊNCIA DE MUDANÇA, medida no que cada coisa é:
//
//   data      — muda a cada edição do template/vínculo (o mais quente)
//   actions   — NUNCA muda; identidade estável pela vida do provider
//   selection — muda a cada clique no canvas
//   ui        — muda a cada troca de aba / colapso / modo isolado
//   config    — muda quando as props do <Designer> mudam (quase nunca)
//
// `actions` é o load-bearing: é o que permite uma peça memoizada consumir
// mutador sem re-renderizar quando o template muda. Ele só é estável porque
// a Fase 0 reescreveu todo mutador pra ler do `prev` do updater em vez de
// closure — ver o comentário de abertura de designer/actions.ts.
//
// O default é `null` em todos, e os hooks de acesso lançam com mensagem
// nomeando o provider. Diferente do I18nContext (cujo default é o
// dicionário inglês, pra um componente do kit funcionar avulso): peça do
// designer sem template não tem comportamento de fallback nenhum — sem
// estado ela não renderiza nada, e um `null` silencioso viraria "a peça não
// aparece e não diz por quê".

export type DesignerDataValue = {
  template: Template;
  bindings: Binding[];
};

// Todo mutador. `DesignerActions` já é o `ReturnType` da fábrica, então
// adicionar ação lá aparece aqui sem edição.
export type DesignerActionsValue = DesignerActions;

export type DesignerSelectionValue = ReturnType<typeof useSelection>;

export type DesignerUiValue = ReturnType<typeof useTabBar> & {
  sidebarTab: TabKey;
  setSidebarTab: Dispatch<SetStateAction<TabKey>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  tabMenuOpen: boolean;
  setTabMenuOpen: Dispatch<SetStateAction<boolean>>;
  // Modo isolado é UI (o que o canvas MOSTRA); virar a chave é ação
  // (`actions.toggleIsolateBands`, que limpa a seleção junto).
  isolateBands: boolean;
  // Erro do último upload de imagem de fundo — `null` quando não houve.
  // Escrito pelo mutador, lido pelas configurações de página.
  backgroundUploadError: string | null;
};

export type DesignerConfigValue = {
  dataSources: DataSourceOption[] | undefined;
  onCanvasDrop: ((e: DragEvent<HTMLDivElement>) => void) | undefined;
  // Passo da grade em mm. Alinha arrasto, redimensionamento, nascimento de
  // campo novo e colagem — os quatro, desde a 3.0.0.
  gridSizeMm: number | undefined;
  // Selecionar um campo reabre a sidebar colapsada. Default `true` (é o
  // comportamento do 2.x); `false` pra layout onde a sidebar não é a
  // resposta a "cliquei num campo".
  expandOnSelect: boolean;
};

export const DesignerDataContext = createContext<DesignerDataValue | null>(null);
export const DesignerActionsContext = createContext<DesignerActionsValue | null>(null);
export const DesignerSelectionContext = createContext<DesignerSelectionValue | null>(null);
export const DesignerUiContext = createContext<DesignerUiValue | null>(null);
export const DesignerConfigContext = createContext<DesignerConfigValue | null>(null);
