import type { Binding, DataSourceOption, Schema, TableColumnStyle } from "../types";
import { BindingEditor } from "./BindingEditor";
import { PositionFields } from "./PropertyPanelFields";
import { PropertyPanelChart } from "./PropertyPanelChart";
import { PropertyPanelImage } from "./PropertyPanelImage";
import { PropertyPanelKpi } from "./PropertyPanelKpi";
import { PropertyPanelSection } from "./PropertyPanelSection";
import { PropertyPanelTable } from "./PropertyPanelTable";
import { PropertyPanelText } from "./PropertyPanelText";
import { Badge, Button, CardHeader } from "./ui";
import { IconBringToFront, IconSendToBack } from "./ui/icons";

type Props = {
  schema: Schema;
  binding: Binding | undefined;
  onChangeSchema: (patch: Partial<Schema>) => void;
  onChangeBinding: (b: Binding | null) => void;
  onRemove: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
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

// Painel do campo selecionado — posição/tamanho, propriedades específicas
// do tipo (texto/tabela/imagem/seção, cada uma no seu próprio componente) e
// o vínculo com o JSON, tudo React normal (sem ponte de módulo, sem
// propPanel declarativo).
export function PropertyPanel({
  schema,
  binding,
  onChangeSchema,
  onChangeBinding,
  onRemove,
  onBringToFront,
  onSendToBack,
  dataSources,
  tableDataSource,
  onSetHeadList,
  onAddTableColumn,
  onRemoveTableColumn,
  onReorderTableColumn,
  onSetColumnStyle,
  onSetColumnFormula,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <CardHeader>
        <Badge>{schema.name}</Badge>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onSendToBack} title="Enviar para trás" aria-label="Enviar para trás">
            <IconSendToBack />
          </Button>
          <Button variant="ghost" size="icon" onClick={onBringToFront} title="Trazer para frente" aria-label="Trazer para frente">
            <IconBringToFront />
          </Button>
          <Button variant="danger" onClick={onRemove}>
            Remover
          </Button>
        </div>
      </CardHeader>

      {schema.type !== "table" && <PositionFields schema={schema} onChangeSchema={onChangeSchema} />}

      {schema.type === "text" && <PropertyPanelText schema={schema} onChangeSchema={onChangeSchema} />}

      {schema.type === "table" && (
        <PropertyPanelTable
          schema={schema}
          binding={binding}
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
      )}

      {schema.type === "image" && <PropertyPanelImage schema={schema} onChangeSchema={onChangeSchema} />}

      {schema.type === "section" && <PropertyPanelSection schema={schema} binding={binding} dataSources={dataSources} />}

      {schema.type === "chart" && <PropertyPanelChart schema={schema} onChangeSchema={onChangeSchema} />}

      {schema.type === "kpi" && <PropertyPanelKpi schema={schema} onChangeSchema={onChangeSchema} />}

      {schema.type !== "table" && schema.type !== "kpi" && (
        <BindingEditor schema={schema} binding={binding} onChangeBinding={onChangeBinding} dataSources={dataSources} />
      )}
    </div>
  );
}
