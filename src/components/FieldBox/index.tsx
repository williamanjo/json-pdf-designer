import type { Schema } from "../../types";
import { ChartField } from "./ChartField";
import { ImageField } from "./ImageField";
import { KpiField } from "./KpiField";
import { SectionField } from "./SectionField";
import { TableField } from "./TableField";
import { TextField } from "./TextField";

type Props = {
  schema: Schema;
  editing?: boolean;
  onUpdate?: (patch: Partial<Schema>) => void;
  onStopEditing?: () => void;
};

// Renderiza o conteúdo de um campo no canvas — texto/tabela/imagem/seção/
// gráfico/indicador — de acordo com o design-time content do schema (não
// os dados reais, que só entram na hora de gerar o PDF). Em modo
// `editing`, texto e tabela viram inputs editáveis direto em cima do
// campo (duplo clique liga o modo). Um arquivo por tipo (ver ./TextField,
// ./TableField...) — este arquivo só decide qual usar.
export function FieldBox({ schema, editing = false, onUpdate, onStopEditing }: Props) {
  if (schema.type === "text") {
    return <TextField schema={schema} editing={editing} onUpdate={onUpdate} onStopEditing={onStopEditing} />;
  }

  if (schema.type === "table") {
    return <TableField schema={schema} editing={editing} onUpdate={onUpdate} onStopEditing={onStopEditing} />;
  }

  if (schema.type === "section") {
    return <SectionField schema={schema} />;
  }

  if (schema.type === "chart") {
    return <ChartField schema={schema} />;
  }

  if (schema.type === "kpi") {
    return <KpiField schema={schema} />;
  }

  // image — duplo clique troca o arquivo direto (não tem "texto" pra editar)
  return <ImageField schema={schema} onUpdate={onUpdate} />;
}
