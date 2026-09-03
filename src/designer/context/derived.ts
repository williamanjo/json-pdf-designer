import { filterIncomplete } from "../../fieldWarnings";
import { classifyZone, isRedZone } from "../../zones";
import type { Binding, Schema, Template } from "../../types";
import { FILTERABLE_TYPES } from "../useTabBar";

// Derivações puras do estado do editor. Ficam separadas dos hooks porque o
// provider TAMBÉM precisa de algumas (pra alimentar `useTabBar`), e um
// arquivo de hook não pode ser chamado de dentro de outro hook sem virar
// regra de hook. Aqui é só função de `(estado) => derivado`.

// A faixa "vermelha" da página (cabeçalho/rodapé/margem esquerda/direita),
// com os `undefined` do template já normalizados pra 0.
export function bandsOf(template: Template) {
  return {
    headerHeight: template.headerHeight ?? 0,
    footerHeight: template.footerHeight ?? 0,
    marginLeft: template.marginLeft ?? 0,
    marginRight: template.marginRight ?? 0,
  };
}

// A lista espelha o que o canvas mostra: no modo isolado só a faixa
// vermelha; fora dele, só o corpo. Senão a lista mostraria campo escondido
// no canvas, sem jeito de clicar nele.
export function fieldListSchemasOf(template: Template, isolateBands: boolean): Schema[] {
  const bands = bandsOf(template);
  return template.schemas.filter((s) => {
    const inRedZone = isRedZone(classifyZone(s, template.page, bands));
    return isolateBands ? inRedZone : !inRedZone;
  });
}

// Edição em bloco: vários campos do MESMO tipo selecionados juntos (texto
// com texto, KPI com KPI, gráfico com gráfico) — só pra esses 3 tipos, que
// já têm uma separação clara de que campo é "estilo" (aplica em todos sem
// problema) e o que é "dados" (cada um tem o próprio conteúdo/vínculo,
// trava pra edição individual). Tipo misto ou tabela/imagem/seção continua
// no comportamento de sempre (só o último selecionado edita).
const BULK_EDIT_TYPES = ["text", "kpi", "chart"] as const;

export function bulkEditOf(template: Template, selectedIds: string[]) {
  const selectedSchemas = template.schemas.filter((s) => selectedIds.includes(s.id));
  const bulkEditActive =
    selectedIds.length > 1 &&
    selectedSchemas.length > 1 &&
    (BULK_EDIT_TYPES as readonly string[]).includes(selectedSchemas[0].type) &&
    selectedSchemas.every((s) => s.type === selectedSchemas[0].type);
  return { selectedSchemas, bulkEditActive };
}

// Ícone de alerta na própria aba — mesma regra de FieldList.tsx
// (fieldWarnings.ts), só que dividida por aba: falta vínculo aparece em
// "Dados", filtro incompleto aparece em "Filtro".
export function tabWarningsOf(selected: Schema | null, selectedBinding: Binding | undefined) {
  return {
    dadosWarning: !!selected && (selected.type === "section" || selected.type === "chart") && !selectedBinding,
    filtroWarning: !!selected && (FILTERABLE_TYPES as readonly string[]).includes(selected.type) && filterIncomplete(selectedBinding),
  };
}
