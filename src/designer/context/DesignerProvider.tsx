import { useMemo, useRef, useState } from "react";
import { DesignerZoomProvider } from "./zoom";
import type { Dispatch, DragEvent, ReactNode, SetStateAction } from "react";
import type { Binding, DataSourceOption, Template } from "../../types";
import { useT } from "../../i18n";
import { makeDesignerActions, type DesignerActions, type DesignerLatest } from "../actions";
import { useClipboardAndDelete } from "../useClipboardAndDelete";
import { useSelection } from "../useSelection";
import { useTabBar, type TabKey } from "../useTabBar";
import { tabWarningsOf } from "./derived";
import {
  DesignerActionsContext,
  DesignerConfigContext,
  DesignerDataContext,
  DesignerSelectionContext,
  DesignerUiContext,
} from "./contexts";

export type DesignerProviderProps = {
  template: Template;
  // Aceita o setState do React direto (forma funcional inclusa) — evita
  // sobrescrever uma mudança concorrente por causa de closure velha (ex:
  // dois campos adicionados em sequência rápida, antes do primeiro render
  // acontecer).
  onChangeTemplate: Dispatch<SetStateAction<Template>>;
  bindings: Binding[];
  onChangeBindings: Dispatch<SetStateAction<Binding[]>>;
  // Passthrough pro container do canvas — usado por quem quer soltar campos
  // externos (ex: um explorador de campos de JSON) direto na página.
  onCanvasDrop?: (e: DragEvent<HTMLDivElement>) => void;
  // Arrays conhecidos do JSON de exemplo — vira dropdown "Data Source" no
  // vínculo de tabela (ver BindingEditor). Sem isso, path digitado livre.
  dataSources?: DataSourceOption[];
  // Passo da grade em mm (default 5, ver units.ts). Alinha arrasto,
  // redimensionamento, nascimento de campo e colagem.
  gridSizeMm?: number;
  // Clicar num campo reabre a sidebar colapsada (default true).
  expandOnSelect?: boolean;
  children: ReactNode;
};

// Todo o estado do editor mora aqui, e cada peça posicionável lê o que
// precisa por hook. O <Designer> é um preset que monta este provider mais
// um layout; quem quer o próprio layout monta o provider na mão.
//
// NÃO exige o I18nProvider por fora: `useT()` tem default (dicionário
// inglês), então o provider funciona avulso. O <Designer> continua
// embrulhando com I18nProvider pra honrar a prop `locale`.
export function DesignerProvider({
  template,
  onChangeTemplate,
  bindings,
  onChangeBindings,
  onCanvasDrop,
  dataSources,
  gridSizeMm,
  expandOnSelect = true,
  children,
}: DesignerProviderProps) {
  const t = useT();

  // ---- estado de UI ------------------------------------------------------
  // Aba do painel lateral direito — "Campos" (lista) e "Página"
  // (tamanho/orientação/margem/fundo) sempre acessíveis; "Dados"/"Estilo"/
  // "Filtro" só existem enquanto um campo está selecionado (ver guarda
  // dentro de useTabBar, que troca de volta pra "campos" quando a seleção
  // some). Declarado cedo porque useSelection/useTabBar abaixo precisam dos
  // setters já prontos.
  const [sidebarTab, setSidebarTab] = useState<TabKey>("campos");
  // Duplo clique na aba ativa fecha (encolhe) o conteúdo; clique simples
  // reabre — ver TabPanel/comentário equivalente em PropertyPanelChart.tsx.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Menu "+" (lista as abas escondidas que caberiam pro campo atual).
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  // Modo isolado: esconde o corpo, mostra só cabeçalho/rodapé/margem, pra
  // editar essas faixas sem o resto da página atrapalhar.
  const [isolateBands, setIsolateBands] = useState(false);
  const [backgroundUploadError, setBackgroundUploadError] = useState<string | null>(null);

  // ---- seleção -----------------------------------------------------------
  // `onActivity` em vez de `setSidebarCollapsed`: seleção não sabe o que é
  // sidebar. Quem liga os dois é este provider, e `expandOnSelect={false}`
  // desliga — necessário pra layout sem sidebar, onde "reabrir" não existe.
  const selection = useSelection({ onActivity: expandOnSelect ? () => setSidebarCollapsed(false) : undefined });
  const { selectedIds, setSelectedIds, selectedId } = selection;

  // ---- ações -------------------------------------------------------------
  // Ref com tudo que as ações precisam LER — e com os próprios setters —
  // atribuída durante o render, lida só na hora do evento. É o que permite
  // criar as ações UMA vez, com lista de dependência vazia; ver o comentário
  // de abertura de designer/actions.ts.
  const latest = useRef<DesignerLatest>({
    template,
    bindings,
    selectedId,
    isolateBands,
    t,
    dataSources,
    gridSizeMm,
    onChangeTemplate,
    onChangeBindings,
    setSelectedIds,
    setIsolateBands,
    setBackgroundUploadError,
  });
  latest.current = {
    template,
    bindings,
    selectedId,
    isolateBands,
    t,
    dataSources,
    gridSizeMm,
    onChangeTemplate,
    onChangeBindings,
    setSelectedIds,
    setIsolateBands,
    setBackgroundUploadError,
  };

  // `useRef` com init preguiçoso, e NÃO `useMemo(..., [])`: a identidade deste
  // objeto é load-bearing (ele vai pro contexto que as peças consomem, e uma
  // troca de identidade derruba `React.memo` em todas elas), e o React
  // documenta `useMemo` como DICA de performance cujo cache pode ser
  // descartado. `useRef` é garantia.
  const actionsRef = useRef<DesignerActions | null>(null);
  actionsRef.current ??= makeDesignerActions(latest);
  const actions = actionsRef.current;

  // ---- atalhos de teclado ------------------------------------------------
  // Delete/Backspace (apaga selecionados) e Ctrl+C/Ctrl+V (copiar/colar).
  // Registrado AQUI, exatamente uma vez: numa peça, quem não renderiza o
  // canvas perderia Delete/Ctrl+V em silêncio; em duas peças, todo paste
  // dispararia dobrado.
  useClipboardAndDelete({ template, bindings, selectedIds, setSelectedIds, onChangeTemplate, onChangeBindings, t, gridSizeMm });

  // ---- derivados que a barra de abas precisa -----------------------------
  // Só o que `useTabBar` consome. O resto dos derivados é hook seletor
  // (ver ./hooks.ts) — cada peça paga o cálculo do que ela mesma lê, em vez
  // de todo mundo re-renderizar porque um derivado alheio mudou.
  const selected = template.schemas.find((s) => s.id === selectedId) ?? null;
  const selectedBinding = selected ? bindings.find((b) => b.schemaName === selected.name) : undefined;
  const { dadosWarning, filtroWarning } = tabWarningsOf(selected, selectedBinding);

  const tabBar = useTabBar({ t, selected, dadosWarning, filtroWarning, sidebarTab, setSidebarTab, setSidebarCollapsed, setTabMenuOpen });

  // ---- values ------------------------------------------------------------
  // `useMemo` por contexto, com as dependências reais de cada um: é isso que
  // faz a divisão em cinco valer. Sem memo, todo value trocaria de
  // identidade a cada render do provider e os cinco contextos
  // re-renderizariam todos os consumidores juntos — exatamente o que a
  // divisão evita.
  const dataValue = useMemo(() => ({ template, bindings }), [template, bindings]);
  const configValue = useMemo(
    () => ({ dataSources, onCanvasDrop, gridSizeMm, expandOnSelect }),
    [dataSources, onCanvasDrop, gridSizeMm, expandOnSelect]
  );
  const uiValue = useMemo(
    () => ({
      ...tabBar,
      sidebarTab,
      setSidebarTab,
      sidebarCollapsed,
      setSidebarCollapsed,
      tabMenuOpen,
      setTabMenuOpen,
      isolateBands,
      backgroundUploadError,
    }),
    [tabBar, sidebarTab, sidebarCollapsed, tabMenuOpen, isolateBands, backgroundUploadError]
  );

  return (
    // `actions` fora dos memos de propósito: a identidade dele é a mesma pra
    // sempre (useRef acima), então não há o que memoizar. `selection` vem do
    // hook já como objeto novo a cada render — memoizar não ajudaria, porque
    // qualquer clique muda `selectedIds` de verdade.
    <DesignerConfigContext.Provider value={configValue}>
      <DesignerActionsContext.Provider value={actions}>
        <DesignerDataContext.Provider value={dataValue}>
          <DesignerSelectionContext.Provider value={selection}>
            <DesignerUiContext.Provider value={uiValue}>
              {/* Zoom por ÚLTIMO, dentro do contexto de dados: ele lê
                  `template.page` pra calcular o "ajustar largura/altura", e
                  é o contexto mais interno de propósito — quem não chama
                  `useDesignerZoom()` não re-renderiza quando o zoom muda. */}
              <DesignerZoomProvider>{children}</DesignerZoomProvider>
            </DesignerUiContext.Provider>
          </DesignerSelectionContext.Provider>
        </DesignerDataContext.Provider>
      </DesignerActionsContext.Provider>
    </DesignerConfigContext.Provider>
  );
}
