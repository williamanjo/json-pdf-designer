import type { CSSProperties } from "react";
import { PropertyPanel } from "../../components/PropertyPanel";
import { PositionFields, VisibleWhenField } from "../../components/PropertyPanelFields";
import { cx, type PartStyle } from "../../components/ui/cx";
import { fieldSourcesFor, findTableDataSource } from "../helpers";
import {
  useDesignerActions,
  useDesignerBulkEdit,
  useDesignerConfig,
  useDesignerData,
  useDesignerSelectedSchema,
  useDesignerSelection,
} from "../context/hooks";
import { SelectedFieldHeader } from "./SelectedFieldHeader";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerPropertyPanelProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
  // Qual metade do painel desenhar. `"dados"` é conteúdo e vínculo,
  // `"estilo"` é aparência — a mesma divisão que as abas fazem.
  //
  // É PROP, e não leitura de `sidebarTab`, justamente pra dar pra pôr as duas
  // metades lado a lado num layout sem abas: duas instâncias, uma com cada
  // `section`. Se isto lesse a aba, a segunda instância desapareceria.
  section?: "dados" | "estilo";
  // Posição/tamanho (X, Y, largura, altura) e "visível quando". Default: só
  // em `section="dados"`, que é onde o <Designer> mostra.
  position?: boolean;
  // Cabeçalho com o nome do campo e o aviso de seleção múltipla.
  header?: boolean;
  parts?: {
    // O `<p>` de "N campos selecionados" / "editando N em bloco".
    banner?: PartStyle;
  };
};

// Peça posicionável: o painel de propriedades do campo selecionado.
//
// Despacha por `schema.type` internamente (texto/tabela/imagem/seção/
// gráfico/KPI) chamando o `<PropertyPanel>` que já existe. Os
// `PropertyPanel{Text,Table,…}` individuais NÃO são peças e nunca serão: um
// `<DesignerTextPanel/>` avulso não tem resposta pra "qual schema?" que não
// seja "o selecionado" — e aí ele é um DesignerPropertyPanel pior.
//
// A raiz é `.jpd-sidebar__panel`, a MESMA que o `Designer.tsx` tinha, e o
// cabeçalho vem por dentro — porque no original os dois eram um único
// `<div>` com gap próprio. Embrulhar num nível extra colapsaria esse gap.
export function DesignerPropertyPanel({ whenTab, ...rest }: DesignerPropertyPanelProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerPropertyPanelBody {...rest} />;
}

function DesignerPropertyPanelBody({
  className,
  style,
  section = "dados",
  position,
  header = true,
  parts,
}: Omit<DesignerPropertyPanelProps, "whenTab">) {
  const { template, bindings } = useDesignerData();
  const { dataSources } = useDesignerConfig();
  const { selectedIds, selectedKpiElement, setSelectedKpiElement } = useDesignerSelection();
  const { selected, selectedBinding } = useDesignerSelectedSchema();
  const { bulkEditActive } = useDesignerBulkEdit();
  const {
    updateSchema,
    updateSchemas,
    handleChangeBinding,
    setTableHead,
    addTableColumn,
    removeTableColumn,
    reorderTableColumn,
    setColumnStyle,
    setColumnWidth,
    setColumnFormula,
  } = useDesignerActions();

  if (!selected) return null;

  const mostraPosicao = position ?? section === "dados";

  return (
    <div className={cx("jpd-sidebar__panel", className)} data-part="property-panel" data-section={section} style={style}>
      {header && <SelectedFieldHeader banner={parts?.banner} />}

      {mostraPosicao && (
        <>
          <PositionFields schema={selected} onChangeSchema={(patch) => updateSchema(selected.id, patch)} />
          <VisibleWhenField schema={selected} onChangeSchema={(patch) => updateSchema(selected.id, patch)} />
        </>
      )}

      <PropertyPanel
        // `key` no id: trocar de campo tem de REMONTAR o painel, senão
        // estado local dele (aba interna, mini-painel de coluna aberto)
        // vaza de um campo pro outro.
        key={selected.id}
        schema={selected}
        binding={selectedBinding}
        activeTab={section}
        bulkEdit={bulkEditActive}
        onChangeSchema={(patch) => (bulkEditActive ? updateSchemas(selectedIds, patch) : updateSchema(selected.id, patch))}
        onChangeBinding={(b) => handleChangeBinding(selected.name, b)}
        dataSources={dataSources}
        tableDataSource={findTableDataSource(selected, template.schemas, bindings, dataSources)}
        fieldSources={fieldSourcesFor(selected, template.schemas, bindings, dataSources)}
        onSetHeadList={setTableHead}
        onAddTableColumn={addTableColumn}
        onRemoveTableColumn={removeTableColumn}
        onReorderTableColumn={reorderTableColumn}
        onSetColumnStyle={setColumnStyle}
        onSetColumnWidth={setColumnWidth}
        onSetColumnFormula={setColumnFormula}
        selectedKpiElement={selectedKpiElement}
        onSelectKpiElement={setSelectedKpiElement}
      />
    </div>
  );
}
