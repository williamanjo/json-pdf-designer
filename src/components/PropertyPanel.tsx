import type { Binding, DataSourceOption, Schema, TableColumnStyle } from "../types";
import { BindingEditor } from "./BindingEditor";
import { PropertyPanelChart } from "./PropertyPanelChart";
import { PropertyPanelImage } from "./PropertyPanelImage";
import { PropertyPanelKpi } from "./PropertyPanelKpi";
import { PropertyPanelSection } from "./PropertyPanelSection";
import { PropertyPanelTable } from "./PropertyPanelTable";
import { PropertyPanelText } from "./PropertyPanelText";

type Props = {
  schema: Schema;
  binding: Binding | undefined;
  // Qual das abas de nível superior (Designer.tsx) tá ativa — este
  // componente só desenha o CONTEÚDO certo pro tipo de campo, a barra de
  // abas em si (e a aba "Filtro", só de gráfico) vive no Designer.
  activeTab: "dados" | "estilo";
  onChangeSchema: (patch: Partial<Schema>) => void;
  onChangeBinding: (b: Binding | null) => void;
  dataSources?: DataSourceOption[];
  // Fonte de dados conhecida da tabela (membro de seção OU vínculo próprio
  // batendo com um dataSources) — lista de colunas pra adicionar com "+"
  // (ver Designer.tsx `findTableDataSource`).
  tableDataSource?: { path: string; columns: string[] };
  // Reescreve a lista de colunas inteira (input "Colunas, vírgula") —
  // mantém content/footer/columnStyles/binding.columns no mesmo tamanho.
  onSetHeadList?: (heads: string[]) => void;
  onAddTableColumn?: (column: string) => void;
  onRemoveTableColumn?: (index: number) => void;
  // Arrastar um item da lista "Colunas atuais da tabela" pra outra posição.
  onReorderTableColumn?: (fromIndex: number, toIndex: number) => void;
  // Estilo (cor/fundo/tamanho) de UMA coluna — cabeçalho e valor
  // separados. Botão "estilo" na lista de colunas abre o mini-painel.
  onSetColumnStyle?: (index: number, patch: Partial<TableColumnStyle>) => void;
  // Fórmula de UMA coluna do vínculo "array" — botão "ƒx" na lista de
  // colunas. Só faz sentido pra tabela com vínculo array de verdade (sem
  // vínculo, o template já é editável direto na célula).
  onSetColumnFormula?: (index: number, formula: string) => void;
};

// Conteúdo do campo selecionado pra aba "Dados"/"Estilo" ativa — cada tipo
// no seu próprio componente (texto/tabela/imagem/seção/gráfico/KPI), sem
// propPanel declarativo, React normal. Image/Section não têm divisão
// Dados/Estilo própria (conteúdo simples demais pra precisar) — tudo delas
// aparece em "Dados"; o vínculo genérico (BindingEditor) só serve a esses
// dois tipos, os outros já embutem o vínculo certo dentro do próprio
// componente (chart) ou nem precisam de um (kpi/texto usam template
// direto no campo, tabela tem o próprio dentro de "Dados").
export function PropertyPanel({
  schema,
  binding,
  activeTab,
  onChangeSchema,
  onChangeBinding,
  dataSources,
  tableDataSource,
  onSetHeadList,
  onAddTableColumn,
  onRemoveTableColumn,
  onReorderTableColumn,
  onSetColumnStyle,
  onSetColumnFormula,
}: Props) {
  if (schema.type === "text") {
    return <PropertyPanelText schema={schema} activeTab={activeTab} onChangeSchema={onChangeSchema} />;
  }

  if (schema.type === "table") {
    return (
      <PropertyPanelTable
        schema={schema}
        binding={binding}
        activeTab={activeTab}
        onChangeSchema={onChangeSchema}
        onChangeBinding={onChangeBinding}
        dataSources={dataSources}
        tableDataSource={tableDataSource}
        onSetHeadList={onSetHeadList}
        onAddTableColumn={onAddTableColumn}
        onRemoveTableColumn={onRemoveTableColumn}
        onReorderTableColumn={onReorderTableColumn}
        onSetColumnStyle={onSetColumnStyle}
        onSetColumnFormula={onSetColumnFormula}
      />
    );
  }

  if (schema.type === "image") {
    return activeTab === "dados" ? (
      <>
        <PropertyPanelImage schema={schema} onChangeSchema={onChangeSchema} />
        <BindingEditor schema={schema} binding={binding} onChangeBinding={onChangeBinding} dataSources={dataSources} />
      </>
    ) : null;
  }

  if (schema.type === "section") {
    return activeTab === "dados" ? (
      <>
        <PropertyPanelSection schema={schema} binding={binding} dataSources={dataSources} />
        <BindingEditor schema={schema} binding={binding} onChangeBinding={onChangeBinding} dataSources={dataSources} />
      </>
    ) : null;
  }

  if (schema.type === "chart") {
    return (
      <PropertyPanelChart
        schema={schema}
        activeTab={activeTab}
        onChangeSchema={onChangeSchema}
        binding={binding}
        onChangeBinding={onChangeBinding}
        dataSources={dataSources}
      />
    );
  }

  // "kpi"
  return <PropertyPanelKpi schema={schema} activeTab={activeTab} onChangeSchema={onChangeSchema} />;
}
