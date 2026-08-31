import { useEffect, useState } from "react";
import type { Dict } from "../i18n";
import type { Schema } from "../types";

// Estado/lógica da barra de abas do painel lateral (Campos/Dados/Estilo/
// Filtro/Página) — extraído de DesignerInner (Designer.tsx) pra um hook
// próprio. Fica num arquivo .ts (não .tsx) porque só exporta hook/tipos/
// função pura, nunca componente — um .tsx só pode exportar componente
// (regra oxlint react(only-export-components), quebra o Fast Refresh
// senão), mesmo motivo de src/bindingBuilders.ts e src/canvasGeometry.ts.

// Tipo do campo selecionado tem aba "Estilo" própria? Texto/tabela/
// gráfico/KPI têm conteúdo visual pra separar de "Dados" — imagem (só um
// data URI) e seção (só um grupo + vínculo) não têm nada pra pôr lá.
function hasEstiloTab(type: Schema["type"]): boolean {
  return type === "text" || type === "table" || type === "chart" || type === "kpi";
}

// Tipos de campo que podem ganhar a aba "Filtro" — todos com vínculo de
// array por trás (chart/table diretos, kpi quando vinculado). Exportado:
// Designer.tsx também usa pra calcular filtroWarning/filterColumns e pra
// decidir se mostra a aba "Filtro" no JSX, fora do escopo deste hook.
export const FILTERABLE_TYPES = ["chart", "table", "kpi"] as const;

export type OptionalTab = "dados" | "estilo" | "filtro";
export type TabKey = "campos" | OptionalTab | "pagina";
// Abas fixáveis/escondíveis no "×" — as três de edição de campo mais
// "Página". "Campos" fica de fora (sempre precisa de um jeito de
// selecionar/adicionar campo, senão não tem como reabrir nada).
export type HideableTab = OptionalTab | "pagina";

// Ordem das abas e quais estão fixadas/escondidas — preferência do
// usuário, sobrevive a reload (localStorage). Tenta ler; se o navegador
// bloquear (modo privado) ou não existir `localStorage` (SSR), cai pro
// padrão sem quebrar — é só uma preferência de UI, não dado do relatório.
const ALL_TAB_KEYS: TabKey[] = ["campos", "dados", "estilo", "filtro", "pagina"];
const TAB_ORDER_STORAGE_KEY = "json-pdf-designer:tab-order";
const HIDDEN_TABS_STORAGE_KEY = "json-pdf-designer:hidden-tabs";

function loadTabOrder(): TabKey[] {
  try {
    const raw = localStorage.getItem(TAB_ORDER_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [...ALL_TAB_KEYS];
    const valid = parsed.filter((k): k is TabKey => ALL_TAB_KEYS.includes(k));
    // Chave nova que uma versão futura adicione entra no fim, em vez de
    // sumir porque a ordem salva é de antes dela existir.
    const missing = ALL_TAB_KEYS.filter((k) => !valid.includes(k));
    return [...valid, ...missing];
  } catch {
    return [...ALL_TAB_KEYS];
  }
}

function loadHiddenTabs(): ReadonlySet<HideableTab> {
  try {
    const raw = localStorage.getItem(HIDDEN_TABS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((k): k is HideableTab => k === "dados" || k === "estilo" || k === "filtro" || k === "pagina")
    );
  } catch {
    return new Set();
  }
}

export type UseTabBarParams = {
  // Dicionário i18n (useT()) — só pros rótulos das abas.
  t: Dict;
  // Campo selecionado atual (null = nenhum) — decide elegibilidade de
  // Dados/Estilo/Filtro.
  selected: Schema | null;
  // Ícone de alerta da aba "Dados"/"Filtro" — calculado em Designer.tsx
  // (depende de selectedBinding/dataSources, fora do escopo deste hook).
  dadosWarning: boolean;
  filtroWarning: boolean;
  // Aba ativa do painel lateral — o estado em si mora em DesignerInner
  // (é lido/setado por bem mais coisa que só a barra de abas: TabPanel,
  // JSX de cada painel etc), este hook só lê/escreve nele.
  sidebarTab: TabKey;
  setSidebarTab: (tab: TabKey) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  // Menu "+" (lista de abas escondidas) — estado também mora em
  // DesignerInner, fechado por este hook ao reabrir/restaurar uma aba.
  setTabMenuOpen: (open: boolean) => void;
};

export function useTabBar({
  t,
  selected,
  dadosWarning,
  filtroWarning,
  sidebarTab,
  setSidebarTab,
  setSidebarCollapsed,
  setTabMenuOpen,
}: UseTabBarParams) {
  // Abas "Dados"/"Estilo"/"Filtro" que o usuário fechou no "×" (ver botão
  // na própria aba) — fica fora da barra até ele reabrir pelo "+", mesmo
  // pra outros campos cujo tipo normalmente mostraria essa aba. É um
  // "fixar/desafixar" simples: não é por campo, é global pro designer
  // inteiro (uma preferência de "eu não uso a aba Estilo", não uma
  // memória por campo).
  const [hiddenOptionalTabs, setHiddenOptionalTabs] = useState<ReadonlySet<HideableTab>>(loadHiddenTabs);
  // Ordem de exibição das 5 abas — arrastar uma em cima da outra troca de
  // posição (ver reorderTabs), independente de estar visível ou não no
  // momento (uma aba escondida guarda o lugar dela pra quando reaparecer).
  const [tabOrder, setTabOrder] = useState<TabKey[]>(loadTabOrder);
  const [draggedTab, setDraggedTab] = useState<TabKey | null>(null);
  // Aba sobrevoada durante o arraste — mostra a barrinha indicadora (a
  // arrastada vai parar ANTES dela, ver reorderTabs).
  const [dragOverTab, setDragOverTab] = useState<TabKey | null>(null);

  function reorderTabs(from: TabKey, to: TabKey) {
    if (from === to) return;
    setTabOrder((prev) => {
      const next = prev.filter((k) => k !== from);
      next.splice(next.indexOf(to), 0, from);
      return next;
    });
  }

  useEffect(() => {
    try {
      localStorage.setItem(TAB_ORDER_STORAGE_KEY, JSON.stringify(tabOrder));
    } catch {
      // Modo privado, storage cheio, ou sem localStorage (SSR) — a
      // preferência simplesmente não persiste, sem quebrar o designer.
    }
  }, [tabOrder]);
  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_TABS_STORAGE_KEY, JSON.stringify([...hiddenOptionalTabs]));
    } catch {
      // Idem.
    }
  }, [hiddenOptionalTabs]);

  // "×" na própria aba — fixa ela como escondida (guarda abaixo tira o
  // usuário de cima dela se for a ativa). "+" reabre chamando de volta
  // com o mesmo nome.
  function hideOptionalTab(tab: HideableTab) {
    setHiddenOptionalTabs((prev) => new Set(prev).add(tab));
  }
  function showOptionalTab(tab: HideableTab) {
    setHiddenOptionalTabs((prev) => {
      const next = new Set(prev);
      next.delete(tab);
      return next;
    });
    setSidebarTab(tab);
    setSidebarCollapsed(false);
    setTabMenuOpen(false);
  }

  // Guarda contra aba órfã — "Campos" sempre existe, nunca precisa de
  // guarda; "Página" só precisa checar se o usuário não a escondeu;
  // "Dados"/"Estilo"/"Filtro" também dependem de ter campo selecionado
  // do tipo certo. Qualquer aba que deixe de valer pra situação atual
  // (seleção sumiu, mudou de tipo, ou o usuário fechou a ativa no "×")
  // cai pra "Campos" — nunca fica sem nenhuma aba marcada.
  useEffect(() => {
    if (sidebarTab === "campos") return;
    if (sidebarTab === "pagina") {
      if (hiddenOptionalTabs.has("pagina")) setSidebarTab("campos");
      return;
    }
    if (!selected) {
      setSidebarTab("campos");
      return;
    }
    const stillEligible =
      (sidebarTab === "dados" && !hiddenOptionalTabs.has("dados")) ||
      (sidebarTab === "estilo" && hasEstiloTab(selected.type) && !hiddenOptionalTabs.has("estilo")) ||
      (sidebarTab === "filtro" && FILTERABLE_TYPES.includes(selected.type as (typeof FILTERABLE_TYPES)[number]) && !hiddenOptionalTabs.has("filtro"));
    if (!stillEligible) setSidebarTab("campos");
  }, [selected, sidebarTab, hiddenOptionalTabs, setSidebarTab]);

  // "Campos" é a única fixa de verdade (sem "×") — precisa de um jeito
  // sempre disponível de selecionar/adicionar campo. As outras quatro
  // entram e saem conforme o tipo do campo selecionado (Dados/Estilo/
  // Filtro) e o que o usuário já escondeu (hiddenOptionalTabs, inclui
  // "Página"). "removable" só marca quem pode ganhar o "×" quando ativa.
  const tabDefs: Record<TabKey, { label: string; eligible: boolean; warning: boolean; removable: boolean }> = {
    campos: { label: t.tabBar.fields, eligible: true, warning: false, removable: false },
    dados: { label: t.tabBar.data, eligible: !!selected, warning: dadosWarning, removable: true },
    estilo: { label: t.tabBar.style, eligible: !!selected && hasEstiloTab(selected.type), warning: false, removable: true },
    filtro: {
      label: t.tabBar.filter,
      eligible: !!selected && (FILTERABLE_TYPES as readonly string[]).includes(selected.type),
      warning: filtroWarning,
      removable: true,
    },
    pagina: { label: t.tabBar.page, eligible: true, warning: false, removable: true },
  };
  const orderedVisibleTabs = tabOrder
    .map((key) => ({ key, ...tabDefs[key] }))
    .filter((tab) => tab.eligible && !(tab.removable && hiddenOptionalTabs.has(tab.key as HideableTab)));
  const addableOptionalTabs = (["dados", "estilo", "filtro", "pagina"] as const)
    .map((key) => ({ key, ...tabDefs[key] }))
    .filter((tab) => tab.eligible && hiddenOptionalTabs.has(tab.key));
  const tabsCustomized = hiddenOptionalTabs.size > 0 || tabOrder.some((k, i) => k !== ALL_TAB_KEYS[i]);

  function restoreDefaultTabs() {
    setTabOrder([...ALL_TAB_KEYS]);
    setHiddenOptionalTabs(new Set());
    setTabMenuOpen(false);
  }

  return {
    orderedVisibleTabs,
    addableOptionalTabs,
    tabsCustomized,
    reorderTabs,
    hideOptionalTab,
    showOptionalTab,
    restoreDefaultTabs,
    draggedTab,
    setDraggedTab,
    dragOverTab,
    setDragOverTab,
  };
}
